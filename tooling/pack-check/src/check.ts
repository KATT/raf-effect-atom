import { Predicate, Schema } from "effect";

/** An `exports` value: a path, `null`, or conditions or subpaths over more. */
type Exports = string | null | { readonly [key: string]: Exports };

const Exports: Schema.Codec<Exports> = Schema.suspend(() =>
	Schema.Union([
		Schema.String,
		Schema.Null,
		Schema.Record(Schema.String, Exports),
	]),
);

const Dependencies = Schema.optionalKey(
	Schema.Record(Schema.String, Schema.String),
);

/** The fields of a packed `package.json` the checks read. */
export const Manifest = Schema.Struct({
	dependencies: Dependencies,
	devDependencies: Dependencies,
	exports: Schema.optionalKey(Exports),
	name: Schema.String,
	optionalDependencies: Dependencies,
	peerDependencies: Dependencies,
	peerDependenciesMeta: Schema.optionalKey(
		Schema.Record(
			Schema.String,
			Schema.Struct({ optional: Schema.optionalKey(Schema.Boolean) }),
		),
	),
	version: Schema.String,
});
export type Manifest = typeof Manifest.Type;

export interface Tarball {
	/** The `.mjs` files in the tarball that start with `"use client"`. */
	readonly clientModules: ReadonlySet<string>;
	/** Paths inside the tarball, relative to its `package/` directory. */
	readonly files: ReadonlyArray<string>;
	readonly manifest: Manifest;
}

const dependencyFields = [
	"dependencies",
	"devDependencies",
	"optionalDependencies",
	"peerDependencies",
] as const;

/** Specifiers that only mean something inside this pnpm workspace. */
const workspaceProtocol = /^(?:workspace|catalog):/;

const required = ["LICENSE", "README.md", "package.json"];

/** Comments and whitespace before a module's first statement. */
const leadingTrivia = /^(?:\s+|\/\/[^\n]*|\/\*[\s\S]*?\*\/)*/;

const useClient = /^["']use client["']/;

/** Every file path an `exports` value points at, through nested conditions. */
const exportTargets = (value: Exports | undefined): ReadonlyArray<string> => {
	if (value === null || value === undefined) {
		return [];
	}
	if (Predicate.isString(value)) {
		return [value];
	}
	return Object.values(value).flatMap(exportTargets);
};

/** The subpaths a consumer imports: `raf-effect-atom`, `raf-effect-atom/rsc`. */
export const specifiers = (manifest: Manifest): ReadonlyArray<string> =>
	Predicate.isObject(manifest.exports) &&
	Object.keys(manifest.exports).every((key) => key.startsWith("."))
		? Object.keys(manifest.exports).map((key) =>
				key === "." ? manifest.name : `${manifest.name}/${key.slice(2)}`,
			)
		: [manifest.name];

/**
 * Each subpath whose export has a `react-server` condition, with the file a
 * server components bundler resolves it to.
 */
export const reactServerTargets = (
	manifest: Manifest,
): ReadonlyArray<{ readonly specifier: string; readonly target: string }> =>
	Predicate.isObject(manifest.exports)
		? Object.entries(manifest.exports).flatMap(([key, value]) =>
				Predicate.isObject(value) && Predicate.isString(value["react-server"])
					? [
							{
								specifier:
									key === "."
										? manifest.name
										: `${manifest.name}/${key.slice(2)}`,
								target: value["react-server"],
							},
						]
					: [],
			)
		: [];

/** `src/Hooks.ts` is built to `dist/Hooks.mjs` (`vp pack` with `unbundle`). */
export const builtFile = (source: string) =>
	source.replace(/^src\//, "dist/").replace(/\.tsx?$/, ".mjs");

/** Whether a module's first statement is the `"use client"` directive. */
export const isClientModule = (contents: string) =>
	useClient.test(contents.replace(leadingTrivia, ""));

/**
 * What's wrong with a packed package, as messages; empty when it can be
 * published. `clientSources` are the package's `src/` files that start with
 * `"use client"`, relative to the package directory.
 */
export const tarballProblems = (
	tarball: Tarball,
	clientSources: ReadonlyArray<string>,
): ReadonlyArray<string> => {
	const has = new Set(tarball.files);
	const problems: Array<string> = [];

	for (const file of required) {
		if (!has.has(file)) {
			problems.push(`${file} is missing from the tarball.`);
		}
	}

	for (const field of dependencyFields) {
		for (const [name, range] of Object.entries(tarball.manifest[field] ?? {})) {
			if (workspaceProtocol.test(range)) {
				problems.push(
					`${field}.${name} is "${range}", which only resolves inside this workspace.`,
				);
			}
		}
	}

	const targets = exportTargets(tarball.manifest.exports);
	if (targets.length === 0) {
		problems.push("package.json has no exports.");
	}
	for (const target of targets) {
		const file = target.replace(/^\.\//, "");
		if (!file.startsWith("dist/")) {
			problems.push(
				`exports points at ${target}, outside dist/: publishConfig.exports wasn't applied.`,
			);
		} else if (!has.has(file)) {
			problems.push(`exports points at ${target}, which isn't in the tarball.`);
		} else if (
			file.endsWith(".mjs") &&
			!has.has(file.replace(/\.mjs$/, ".d.mts"))
		) {
			problems.push(`${target} has no type declarations next to it (.d.mts).`);
		}
	}

	for (const source of clientSources) {
		const built = builtFile(source);
		if (!has.has(built)) {
			problems.push(
				`${source} starts with "use client" but ${built} isn't in the tarball.`,
			);
		} else if (!tarball.clientModules.has(built)) {
			problems.push(
				`${source} starts with "use client" but ${built} lost the directive.`,
			);
		}
	}

	return problems;
};
