import { Data, Effect, FileSystem, Path, Schema } from "effect";

/**
 * A package the client bundle must not contain. `dir` is its directory
 * relative to the workspace root when it's a workspace package; any package
 * is also found under `node_modules/<name>/`.
 */
export interface ForbiddenPackage {
	readonly dir: string | undefined;
	readonly name: string;
}

/** A source in a client chunk's source map that belongs to a forbidden package. */
interface Leak {
	readonly chunk: string;
	readonly packageName: string;
	readonly source: string;
}

interface Report {
	/** Chunks checked through their source maps, relative to the client dir. */
	readonly chunks: ReadonlyArray<string>;
	readonly leaks: ReadonlyArray<Leak>;
	/** JavaScript files with no source map, such as Rolldown's runtime. */
	readonly unmapped: ReadonlyArray<string>;
}

export class NoSourceMaps extends Data.TaggedError("NoSourceMaps")<{
	readonly dir: string;
}> {
	override get message() {
		return `No source maps in ${this.dir}, so nothing can be checked. Build the client with source maps: \`build.sourcemap: "hidden"\` in Vite, \`productionBrowserSourceMaps: true\` in Next.js.`;
	}
}

const SourceMap = Schema.fromJsonString(
	Schema.Struct({
		sourceRoot: Schema.optionalKey(Schema.String),
		sources: Schema.Array(Schema.NullOr(Schema.String)),
	}),
);

const scheme = /^[a-z][\w+.-]*:\/+/i;

/**
 * A chunk's link to its map. Turbopack names a map after its contents rather
 * than its chunk, so `<chunk>.map` doesn't find it.
 */
const sourceMappingUrl = /\/\/# sourceMappingURL=(?!data:)(\S+)\s*$/;

const toPosix = (file: string) => file.replaceAll("\\", "/");

/**
 * Where a `sources` entry's file is. A relative entry (Vite, Rolldown)
 * resolves against the map's directory to a path on disk. An entry with a
 * scheme (`file:///…`, Turbopack's `turbopack:///[project]/…`) drops the
 * scheme; `[project]` isn't a directory, so it's matched by suffix.
 */
const sourceFile = (
	path: Path.Path,
	mapDir: string,
	sourceRoot: string,
	source: string,
) => {
	const file = source.replace(/[?#].*$/, "");
	return scheme.test(file)
		? { onDisk: false, path: toPosix(file.replace(scheme, "/")) }
		: { onDisk: true, path: toPosix(path.resolve(mapDir, sourceRoot, file)) };
};

const belongsTo = (
	file: ReturnType<typeof sourceFile>,
	root: string,
	pkg: ForbiddenPackage,
) => {
	if (file.path.includes(`/node_modules/${pkg.name}/`)) {
		return true;
	}
	if (pkg.dir === undefined) {
		return false;
	}
	const dir = `/${toPosix(pkg.dir)}/`;
	return file.onDisk
		? file.path.startsWith(`${toPosix(root)}${dir}`)
		: file.path.includes(dir);
};

/**
 * Reads every source map under `clientDir` and reports the sources that
 * belong to a forbidden package. A bundler lists a module in `sources` when
 * it contributed code to the chunk, so a tree-shaken import doesn't count and
 * any code that ships does. Fails with {@link NoSourceMaps} when there are no
 * maps, rather than passing a build it couldn't read.
 */
export const check = Effect.fn("check")(function* (options: {
	readonly clientDir: string;
	readonly forbidden: ReadonlyArray<ForbiddenPackage>;
	readonly root: string;
}) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const files = (yield* fs.readDirectory(options.clientDir, {
		recursive: true,
	}))
		.map(toPosix)
		.toSorted();
	const maps = files.filter((file) => file.endsWith(".map"));
	if (maps.length === 0) {
		return yield* new NoSourceMaps({ dir: options.clientDir });
	}
	const mapped = new Set(maps);
	const chunkOf = new Map<string, string>();
	const unmapped: Array<string> = [];
	for (const chunk of files.filter((file) => /\.[cm]?js$/.test(file))) {
		const contents = yield* fs.readFileString(
			path.join(options.clientDir, chunk),
		);
		const url = sourceMappingUrl.exec(contents)?.[1];
		const map =
			url === undefined
				? `${chunk}.map`
				: toPosix(path.join(path.dirname(chunk), url));
		if (mapped.has(map)) {
			chunkOf.set(map, chunk);
		} else {
			unmapped.push(chunk);
		}
	}

	const chunkName = (map: string) =>
		chunkOf.get(map) ?? map.replace(/\.map$/, "");

	const leaks: Array<Leak> = [];
	for (const map of maps) {
		const decoded = yield* Schema.decodeEffect(SourceMap)(
			yield* fs.readFileString(path.join(options.clientDir, map)),
		);
		const mapDir = path.dirname(path.join(options.clientDir, map));
		for (const source of decoded.sources) {
			if (source === null) {
				continue;
			}
			const file = sourceFile(path, mapDir, decoded.sourceRoot ?? "", source);
			for (const pkg of options.forbidden) {
				if (belongsTo(file, options.root, pkg)) {
					leaks.push({
						chunk: chunkName(map),
						packageName: pkg.name,
						source,
					});
				}
			}
		}
	}
	return {
		chunks: maps.map(chunkName),
		leaks,
		unmapped,
	} satisfies Report;
});
