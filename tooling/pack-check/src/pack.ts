import {
	Console,
	Data,
	Effect,
	FileSystem,
	Path,
	Schema,
	Stream,
} from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";

import { isClientModule, Manifest, specifiers, type Tarball } from "./check.ts";

class CommandFailed extends Data.TaggedError("CommandFailed")<{
	readonly command: string;
	readonly exitCode: number;
}> {
	override get message() {
		return `${this.command} exited with ${this.exitCode}`;
	}
}

/**
 * Runs a command in `cwd` and returns its stdout; stderr goes to the
 * terminal. On a non-zero exit, prints stdout (where `tsc` reports) and fails.
 */
const run = Effect.fn("run")(function* (
	cwd: string,
	command: string,
	args: ReadonlyArray<string>,
) {
	const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
	const handle = yield* spawner.spawn(
		ChildProcess.make(command, args, { cwd, stderr: "inherit" }),
	);
	const [stdout, exitCode] = yield* Effect.all(
		[handle.stdout.pipe(Stream.decodeText(), Stream.mkString), handle.exitCode],
		{ concurrency: "unbounded" },
	);
	if (exitCode !== ChildProcessSpawner.ExitCode(0)) {
		yield* Console.error(stdout);
		return yield* new CommandFailed({
			command: [command, ...args].join(" "),
			exitCode,
		});
	}
	return stdout;
}, Effect.scoped);

const decodeManifest = Schema.decodeEffect(Schema.fromJsonString(Manifest));

const PrivateFlag = Schema.fromJsonString(
	Schema.Struct({ private: Schema.optionalKey(Schema.Boolean) }),
);

/** Files under `dir`, recursively, relative to it. */
const filesIn = Effect.fn("filesIn")(function* (dir: string) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const entries = yield* fs.readDirectory(dir, { recursive: true });
	const files = yield* Effect.filter(entries, (entry) =>
		Effect.map(fs.stat(path.join(dir, entry)), (info) => info.type === "File"),
	);
	return files.map((file) => file.split(path.sep).join("/")).toSorted();
});

/** The directories in `packages/` whose `package.json` isn't private. */
export const publishableDirs = Effect.fn("publishableDirs")(function* (
	root: string,
) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const packages = path.join(root, "packages");
	const dirs = (yield* fs.readDirectory(packages)).toSorted();
	return yield* Effect.filter(dirs, (dir) =>
		Effect.gen(function* () {
			const manifest = path.join(packages, dir, "package.json");
			const info = yield* fs.stat(path.join(packages, dir));
			if (info.type !== "Directory" || !(yield* fs.exists(manifest))) {
				return false;
			}
			const pkg = yield* Schema.decodeEffect(PrivateFlag)(
				yield* fs.readFileString(manifest),
			);
			return pkg.private !== true;
		}),
	).pipe(Effect.map((names) => names.map((dir) => path.join(packages, dir))));
});

/** The package's `src/` files that start with `"use client"`. */
export const clientSources = Effect.fn("clientSources")(function* (
	packageDir: string,
) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const sources = (yield* filesIn(path.join(packageDir, "src")))
		.filter((file) => /\.tsx?$/.test(file))
		.map((file) => `src/${file}`);
	return yield* Effect.filter(sources, (source) =>
		Effect.map(
			fs.readFileString(path.join(packageDir, source)),
			isClientModule,
		),
	);
});

export interface Packed {
	/** The `.tgz` `pnpm pack` wrote. */
	readonly file: string;
	readonly tarball: Tarball;
}

/**
 * Packs the package into `outDir` the way its `publish:npm` script does
 * (`pnpm pack`, which runs `prepack` and applies `publishConfig`), then
 * unpacks it to read what npm would get.
 */
export const pack = Effect.fn("pack")(function* (
	packageDir: string,
	outDir: string,
) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const name = path.basename(packageDir);
	const file = path.join(outDir, `${name}.tgz`);
	yield* run(packageDir, "pnpm", ["pack", "--out", file]);

	const unpacked = path.join(outDir, name);
	yield* fs.makeDirectory(unpacked, { recursive: true });
	yield* run(unpacked, "tar", ["-xzf", file]);
	const contents = path.join(unpacked, "package");

	const files = yield* filesIn(contents);
	const manifest = yield* decodeManifest(
		yield* fs.readFileString(path.join(contents, "package.json")),
	);
	const clientModules = new Set(
		yield* Effect.filter(
			files.filter((entry) => entry.endsWith(".mjs")),
			(module) =>
				Effect.map(
					fs.readFileString(path.join(contents, module)),
					isClientModule,
				),
		),
	);
	return { file, tarball: { clientModules, files, manifest } } satisfies Packed;
});

/**
 * Every packed package's peer dependencies, optional ones too, so each
 * subpath can load. Two packages asking for different ranges get both
 * (`^19.0.0 ^19.2.0`), which npm reads as their intersection.
 */
const peerRanges = (packed: ReadonlyArray<Packed>) => {
	const own = new Set(packed.map((entry) => entry.tarball.manifest.name));
	const ranges = new Map<string, Array<string>>();
	for (const { tarball } of packed) {
		for (const [name, range] of Object.entries(
			tarball.manifest.peerDependencies ?? {},
		)) {
			if (own.has(name)) {
				continue;
			}
			const existing = ranges.get(name) ?? [];
			if (!existing.includes(range)) {
				existing.push(range);
			}
			ranges.set(name, existing);
		}
	}
	return Object.fromEntries(
		[...ranges].map(([name, list]) => [name, list.join(" ")]),
	);
};

/** The `@types/react` the packages build against, for the type check. */
const reactTypes = (packed: ReadonlyArray<Packed>) =>
	packed
		.map((entry) => entry.tarball.manifest.devDependencies?.["@types/react"])
		.find((version) => version !== undefined);

const tsconfig = (module: "bundler" | "nodenext") =>
	JSON.stringify({
		compilerOptions: {
			lib: ["ES2024", "DOM"],
			module: module === "bundler" ? "preserve" : "nodenext",
			moduleResolution: module,
			noEmit: true,
			// Checks the packages' own declarations too, not only that they resolve.
			skipLibCheck: false,
			strict: true,
			target: "ES2024",
			types: [],
		},
		files: ["index.ts"],
	});

/**
 * Installs the tarballs with their peers into a fresh npm project in
 * `outDir/consumer`, then imports every subpath in Node and type-checks an
 * import of each with `tsc` under `nodenext` and `bundler` resolution.
 */
export const consume = Effect.fn("consume")(function* (
	root: string,
	outDir: string,
	packed: ReadonlyArray<Packed>,
) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const dir = path.join(outDir, "consumer");
	yield* fs.makeDirectory(dir, { recursive: true });

	const dependencies: Record<string, string> = peerRanges(packed);
	const types = reactTypes(packed);
	if (types !== undefined) {
		dependencies["@types/react"] = types;
	}
	for (const entry of packed) {
		dependencies[entry.tarball.manifest.name] = `file:${entry.file}`;
	}
	yield* fs.writeFileString(
		path.join(dir, "package.json"),
		JSON.stringify({
			dependencies,
			name: "pack-check-consumer",
			private: true,
			type: "module",
		}),
	);
	yield* Console.log(`npm install ${Object.keys(dependencies).join(" ")}`);
	yield* run(dir, "npm", [
		"install",
		"--no-audit",
		"--no-fund",
		"--loglevel=error",
	]);

	const imports = packed.flatMap((entry) => specifiers(entry.tarball.manifest));
	yield* fs.writeFileString(
		path.join(dir, "imports.mjs"),
		[
			`for (const specifier of ${JSON.stringify(imports)}) {`,
			"\tconst names = Object.keys(await import(specifier));",
			"\tif (names.length === 0) throw new Error(`${specifier} exports nothing`);",
			"\tconsole.log(`import ${specifier}: ${names.length} exports`);",
			"}",
			"",
		].join("\n"),
	);
	yield* Console.log(yield* run(dir, "node", ["imports.mjs"]));

	yield* fs.writeFileString(
		path.join(dir, "index.ts"),
		[
			...imports.map(
				(specifier, i) => `import * as m${i} from "${specifier}";`,
			),
			`export const modules = [${imports.map((_, i) => `m${i}`).join(", ")}];`,
			"",
		].join("\n"),
	);
	const tsc = path.join(root, "node_modules", ".bin", "tsc");
	for (const module of ["nodenext", "bundler"] as const) {
		const config = `tsconfig.${module}.json`;
		yield* fs.writeFileString(path.join(dir, config), tsconfig(module));
		yield* run(dir, tsc, ["-p", config]);
		yield* Console.log(
			`tsc (${module} resolution): ${imports.length} imports type-check`,
		);
	}
});
