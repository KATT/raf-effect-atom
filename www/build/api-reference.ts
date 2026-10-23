import { Effect, FileSystem, Path, Predicate, Schema } from "effect";
import { format } from "oxfmt";
// The compiler's JavaScript API, which TypeScript 7 doesn't have.
import ts from "typescript6";

import { ContentError, messageOf } from "./content-error.ts";

/** An export of an entrypoint, or a member of a namespace it exports. */
export interface ApiExport {
	readonly doc: ApiDoc;
	/** Its anchor on the entrypoint's page: `useAtomResult`, `Loader.ensure`. */
	readonly id: string;
	/** The declaration keyword: `function`, `const`, `interface`, … */
	readonly kind: string;
	readonly name: string;
	/** Its declarations as a `.d.ts` file has them, without the JSDoc. */
	readonly signatures: ReadonlyArray<string>;
	/** Where it's declared, from the repository's root, and the line. */
	readonly source: { readonly line: number; readonly path: string };
}

/** JSDoc, as markdown. `{@link name}` is left for the page to resolve. */
export interface ApiDoc {
	readonly category: string | undefined;
	readonly deprecated: string | undefined;
	readonly description: string;
	readonly examples: ReadonlyArray<string>;
	readonly params: ReadonlyArray<{
		readonly name: string;
		readonly text: string;
	}>;
	readonly returns: string | undefined;
	readonly see: ReadonlyArray<string>;
	readonly since: string | undefined;
}

/**
 * A module an entrypoint exports from: a namespace (`export * as Loader`),
 * whose members are `Loader.<name>`, or a file whose exports it re-exports
 * by name.
 */
export interface ApiGroup {
	readonly description: string;
	readonly exports: ReadonlyArray<ApiExport>;
	readonly id: string;
	/** Whether the entry file declares the group's exports itself. */
	readonly inEntry: boolean;
	/** The namespace export itself, when the group is one. */
	readonly namespace: ApiExport | undefined;
	readonly title: string;
}

/** One `exports` entry of a published package: `raf-effect-atom/next`. */
export interface ApiEntry {
	/** The entry module's JSDoc, or the package's description. */
	readonly description: string;
	readonly groups: ReadonlyArray<ApiGroup>;
	readonly packageName: string;
	/** The `.ts` file the entry points at, from the repository's root. */
	readonly sourcePath: string;
	readonly specifier: string;
}

export interface ApiReference {
	readonly entries: ReadonlyArray<ApiEntry>;
	/** `specifier#id` of each export with no JSDoc description. */
	readonly undocumented: ReadonlyArray<string>;
}

/** An `exports` target: a path, or conditions that each lead to one. */
type ExportTarget = string | { readonly [condition: string]: ExportTarget };

const ExportTarget: Schema.Codec<ExportTarget> = Schema.Union([
	Schema.String,
	Schema.Record(
		Schema.String,
		Schema.suspend((): Schema.Codec<ExportTarget> => ExportTarget),
	),
]);

const PackageJson = Schema.fromJsonString(
	Schema.Struct({
		description: Schema.optional(Schema.String),
		exports: Schema.optional(Schema.Record(Schema.String, ExportTarget)),
		name: Schema.String,
		private: Schema.optional(Schema.Boolean),
	}),
);

const decodePackageJson = Schema.decodeUnknownEffect(PackageJson);

/** The file an `exports` target resolves to without conditions a bundler sets. */
function exportTarget(target: ExportTarget | undefined): string | undefined {
	if (target === undefined || Predicate.isString(target)) {
		return target;
	}
	return (
		exportTarget(target["types"]) ??
		exportTarget(target["import"]) ??
		exportTarget(target["default"])
	);
}

const isSourceFile = (file: string) => /\.(?:m|c)?tsx?$/.test(file);

function flatten(diagnostic: ts.Diagnostic) {
	return ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
}

/** A JSDoc block's text without its `/**`, `*` and `*\/`. */
function commentText(comment: string) {
	return comment
		.replace(/^\/\*\*/, "")
		.replace(/\*\/$/, "")
		.split("\n")
		.map((line) => line.replace(/^\s*\* ?/, ""))
		.join("\n")
		.trim();
}

/** The description of a file's leading JSDoc: what the module is for. */
function moduleDescription(file: ts.SourceFile) {
	const text = file.getFullText();
	const first = ts.getLeadingCommentRanges(text, 0)?.[0];
	if (!first || !text.startsWith("/**", first.pos)) {
		return "";
	}
	const body = commentText(text.slice(first.pos, first.end));
	return body.split(/^@\w+/m)[0]?.trim() ?? "";
}

function tagText(tag: ts.JSDocTagInfo) {
	return ts.displayPartsToString(tag.text).trim();
}

function docOf(symbol: ts.Symbol, checker: ts.TypeChecker): ApiDoc {
	const tags = symbol.getJsDocTags(checker);
	const all = (name: string) =>
		tags.filter((tag) => tag.name === name).map(tagText);
	const one = (name: string) => all(name)[0];
	return {
		category: one("category"),
		deprecated: tags.some((tag) => tag.name === "deprecated")
			? (one("deprecated") ?? "")
			: undefined,
		description: ts
			.displayPartsToString(symbol.getDocumentationComment(checker))
			.trim(),
		examples: all("example"),
		params: tags.flatMap((tag) => {
			if (tag.name !== "param") {
				return [];
			}
			const [name, ...rest] = tagText(tag).split(/\s+/);
			return name ? [{ name, text: rest.join(" ") }] : [];
		}),
		returns: one("returns") ?? one("return"),
		see: all("see"),
		since: one("since"),
	};
}

function declarationName(statement: ts.Statement): ReadonlyArray<string> {
	if (ts.isVariableStatement(statement)) {
		return statement.declarationList.declarations.flatMap((declaration) =>
			ts.isIdentifier(declaration.name) ? [declaration.name.text] : [],
		);
	}
	if (
		(ts.isFunctionDeclaration(statement) ||
			ts.isClassDeclaration(statement) ||
			ts.isInterfaceDeclaration(statement) ||
			ts.isTypeAliasDeclaration(statement) ||
			ts.isEnumDeclaration(statement) ||
			ts.isModuleDeclaration(statement)) &&
		statement.name &&
		ts.isIdentifier(statement.name)
	) {
		return [statement.name.text];
	}
	return [];
}

function kindOf(declaration: ts.Declaration) {
	if (ts.isFunctionDeclaration(declaration)) {
		return "function";
	}
	if (ts.isVariableDeclaration(declaration)) {
		return ts.getCombinedNodeFlags(declaration) & ts.NodeFlags.Const
			? "const"
			: "let";
	}
	if (ts.isClassDeclaration(declaration)) {
		return "class";
	}
	if (ts.isInterfaceDeclaration(declaration)) {
		return "interface";
	}
	if (ts.isTypeAliasDeclaration(declaration)) {
		return "type";
	}
	if (ts.isEnumDeclaration(declaration)) {
		return "enum";
	}
	return "namespace";
}

/** Statements of a `.d.ts`, by the name they declare. */
function statementsByName(file: ts.SourceFile) {
	const byName = new Map<string, Array<ts.Statement>>();
	for (const statement of file.statements) {
		for (const name of declarationName(statement)) {
			byName.set(name, [...(byName.get(name) ?? []), statement]);
		}
	}
	return byName;
}

/** `use-atom-result` → `Use atom result`; `NextClient` stays as it is. */
function moduleTitle(name: string) {
	const words = name.replaceAll("-", " ");
	return `${words.charAt(0).toUpperCase()}${words.slice(1)}`;
}

function position(symbol: ts.Symbol) {
	return symbol.declarations?.[0]?.getStart() ?? 0;
}

const formatSignature = Effect.fn("formatSignature")(function* (code: string) {
	const result = yield* Effect.promise(() =>
		format("signature.d.ts", code, {
			printWidth: 72,
			semi: true,
			useTabs: false,
		}),
	);
	return result.errors.length ? code : result.code.trim();
});

/**
 * Reads a package's public API: each `exports` entry, its exports and the
 * namespaces it exports, with their JSDoc and their signatures as a `.d.ts`
 * file declares them.
 */
const readPackage = Effect.fn("readPackage")(function* (
	repoRoot: string,
	packageDir: string,
) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const manifest = yield* fs
		.readFileString(path.join(packageDir, "package.json"))
		.pipe(Effect.flatMap(decodePackageJson));
	if (manifest.private) {
		return [];
	}
	const entries = Object.entries(manifest.exports ?? {}).flatMap(
		([subpath, target]) => {
			const file = exportTarget(target);
			return file && isSourceFile(file)
				? [
						{
							file: path.join(packageDir, file),
							specifier:
								subpath === "."
									? manifest.name
									: `${manifest.name}/${subpath.replace(/^\.\//, "")}`,
						},
					]
				: [];
		},
	);
	if (entries.length === 0) {
		return [];
	}

	const configFile = path.join(packageDir, "tsconfig.json");
	const parsed = yield* Effect.try({
		catch: (cause) =>
			new ContentError({
				cause,
				message: `${configFile}: ${messageOf(cause)}`,
			}),
		try: () =>
			ts.getParsedCommandLineOfConfigFile(configFile, undefined, {
				...ts.sys,
				onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
					throw new Error(flatten(diagnostic));
				},
			}),
	});
	if (!parsed) {
		return yield* new ContentError({
			message: `${configFile}: invalid tsconfig`,
		});
	}
	const program = ts.createProgram({
		options: {
			...parsed.options,
			declaration: true,
			declarationMap: false,
			emitDeclarationOnly: true,
			noEmit: false,
			removeComments: false,
		},
		rootNames: entries.map((entry) => entry.file),
	});
	const checker = program.getTypeChecker();

	// The declaration emitter writes what each export's type is, inferred or
	// written, the way the published `.d.ts` files have it.
	const declarations = new Map<string, Map<string, Array<ts.Statement>>>();
	const emitted = program.emit(
		undefined,
		(fileName, text) => {
			const dts = ts.createSourceFile(
				fileName,
				text,
				ts.ScriptTarget.Latest,
				true,
			);
			declarations.set(
				fileName.replace(/\.d\.(?:m|c)?ts$/, ""),
				statementsByName(dts),
			);
		},
		undefined,
		true,
	);
	const errors = [...program.getSyntacticDiagnostics(), ...emitted.diagnostics];
	if (errors.length) {
		return yield* new ContentError({
			message: `${manifest.name}: ${errors.map(flatten).join("\n")}`,
		});
	}

	const signaturesOf = Effect.fn("signaturesOf")(function* (symbol: ts.Symbol) {
		const texts = new Set<string>();
		for (const declaration of symbol.declarations ?? []) {
			const file = declaration.getSourceFile();
			const statements = file.isDeclarationFile
				? statementsByName(file).get(symbol.name)
				: declarations
						.get(file.fileName.replace(/\.(?:m|c)?tsx?$/, ""))
						?.get(symbol.name);
			for (const statement of statements ?? []) {
				texts.add(
					statement
						.getText()
						.replace(/^export\s+/, "")
						.replace(/^declare\s+/, ""),
				);
			}
		}
		return yield* Effect.forEach(texts, formatSignature);
	});

	const exportOf = Effect.fn("exportOf")(function* (
		symbol: ts.Symbol,
		id: string,
		name: string,
	) {
		const declaration = symbol.declarations?.[0];
		if (!declaration) {
			return undefined;
		}
		const file = declaration.getSourceFile();
		const isModule = ts.isSourceFile(declaration);
		const doc = docOf(symbol, checker);
		return {
			doc: isModule ? { ...doc, description: moduleDescription(file) } : doc,
			id,
			kind: kindOf(declaration),
			name,
			signatures: isModule ? [] : yield* signaturesOf(symbol),
			source: {
				line: isModule
					? 1
					: file.getLineAndCharacterOfPosition(declaration.getStart()).line + 1,
				path: path.relative(repoRoot, file.fileName),
			},
		} satisfies ApiExport;
	});

	const resolve = (symbol: ts.Symbol) =>
		symbol.flags & ts.SymbolFlags.Alias
			? checker.getAliasedSymbol(symbol)
			: symbol;
	const isInternal = (symbol: ts.Symbol) =>
		symbol.getJsDocTags(checker).some((tag) => tag.name === "internal");

	return yield* Effect.forEach(entries, (entry) =>
		Effect.gen(function* () {
			const file = program.getSourceFile(entry.file);
			const module = file && checker.getSymbolAtLocation(file);
			if (!file || !module) {
				return yield* new ContentError({
					message: `${entry.specifier}: ${entry.file} isn't a module`,
				});
			}
			const groups = new Map<
				string,
				{
					description: string;
					exports: Array<readonly [ts.Symbol, ApiExport]>;
					id: string;
					inEntry: boolean;
					namespace: ApiExport | undefined;
					title: string;
				}
			>();
			for (const exported of checker.getExportsOfModule(module)) {
				const symbol = resolve(exported);
				const declaration = symbol.declarations?.[0];
				if (!declaration || isInternal(symbol)) {
					continue;
				}
				const name = exported.name;
				if (ts.isSourceFile(declaration)) {
					const namespace = yield* exportOf(symbol, name, name);
					const members = yield* Effect.forEach(
						checker
							.getExportsOfModule(symbol)
							.map(resolve)
							.filter((member) => !isInternal(member))
							.toSorted((a, b) => position(a) - position(b)),
						(member) =>
							Effect.map(
								exportOf(
									member,
									`${name}.${member.name}`,
									`${name}.${member.name}`,
								),
								(api) => (api ? [[member, api] as const] : []),
							),
					);
					groups.set(`namespace:${name}`, {
						description: namespace?.doc.description ?? "",
						exports: members.flat(),
						id: name,
						inEntry: false,
						namespace,
						title: name,
					});
					continue;
				}
				const source = declaration.getSourceFile();
				const key = `module:${source.fileName}`;
				const fileName = path
					.basename(source.fileName)
					.replace(/\.(?:m|c)?tsx?$/, "");
				const group = groups.get(key) ?? {
					description: source === file ? "" : moduleDescription(source),
					exports: [],
					id: `module-${fileName}`,
					inEntry: source === file,
					namespace: undefined,
					title: moduleTitle(fileName),
				};
				groups.set(key, group);
				const api = yield* exportOf(symbol, name, name);
				if (api) {
					group.exports.push([symbol, api]);
				}
			}
			// Groups follow the entry's own order: its declarations, then the
			// modules in the order its `export … from` statements name them,
			// through the files it re-exports with `export *`.
			const order = new Map<string, number>([[`module:${file.fileName}`, -1]]);
			const visited = new Set<ts.SourceFile>();
			const walk = (from: ts.SourceFile) => {
				visited.add(from);
				for (const statement of from.statements) {
					if (
						!ts.isExportDeclaration(statement) ||
						!statement.moduleSpecifier
					) {
						continue;
					}
					const target = checker
						.getSymbolAtLocation(statement.moduleSpecifier)
						?.declarations?.find(ts.isSourceFile);
					if (!target) {
						continue;
					}
					const clause = statement.exportClause;
					const key =
						clause && ts.isNamespaceExport(clause)
							? `namespace:${clause.name.text}`
							: `module:${target.fileName}`;
					if (!order.has(key)) {
						order.set(key, order.size);
					}
					if (!clause && !visited.has(target)) {
						walk(target);
					}
				}
			};
			walk(file);
			const rank = (key: string) => order.get(key) ?? Number.MAX_SAFE_INTEGER;
			return {
				description: moduleDescription(file) || (manifest.description ?? ""),
				groups: [...groups.entries()]
					.toSorted(([a], [b]) => rank(a) - rank(b))
					.map(([, group]) => ({
						...group,
						exports: group.exports
							.toSorted(([a], [b]) => position(a) - position(b))
							.map(([, api]) => api),
					})),
				packageName: manifest.name,
				sourcePath: path.relative(repoRoot, entry.file),
				specifier: entry.specifier,
			} satisfies ApiEntry;
		}),
	);
});

/**
 * The public API of every published package in `packagesDir`: each entry of
 * its `exports`, read from the source with the TypeScript compiler.
 */
export const readApiReference = Effect.fn("readApiReference")(
	function* (options: {
		readonly packagesDir: string;
		readonly repoRoot: string;
	}) {
		const fs = yield* FileSystem.FileSystem;
		const path = yield* Path.Path;
		const names = (yield* fs.readDirectory(options.packagesDir)).toSorted();
		const packages = yield* Effect.filter(names, (name) =>
			fs.exists(path.join(options.packagesDir, name, "package.json")),
		);
		const entries = (yield* Effect.forEach(packages, (name) =>
			readPackage(options.repoRoot, path.join(options.packagesDir, name)),
		)).flat();
		const undocumented = entries.flatMap((entry) =>
			entry.groups.flatMap((group) =>
				[...(group.namespace ? [group.namespace] : []), ...group.exports]
					.filter((api) => api.doc.description === "")
					.map((api) => `${entry.specifier}#${api.id}`),
			),
		);
		return { entries, undocumented } satisfies ApiReference;
	},
);
