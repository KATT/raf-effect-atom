import { Data, Effect, FileSystem, Path, Schema, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";

import type { ForbiddenPackage } from "./check.ts";

class WorkspaceError extends Data.TaggedError("WorkspaceError")<{
	readonly message: string;
}> {}

const PnpmList = Schema.fromJsonString(
	Schema.Array(
		Schema.Struct({
			name: Schema.optionalKey(Schema.String),
			path: Schema.String,
		}),
	),
);

/** The nearest directory at or above `cwd` with a `pnpm-workspace.yaml`. */
export const workspaceRoot = Effect.fn("workspaceRoot")(function* (
	cwd: string,
) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	let dir = path.resolve(cwd);
	while (!(yield* fs.exists(path.join(dir, "pnpm-workspace.yaml")))) {
		const parent = path.dirname(dir);
		if (parent === dir) {
			return yield* new WorkspaceError({
				message: `No pnpm-workspace.yaml at or above ${cwd}`,
			});
		}
		dir = parent;
	}
	return yield* fs.realPath(dir);
});

/**
 * Each name with its directory relative to `root` when it's a workspace
 * package, from `pnpm ls`. Other names are only found in `node_modules`.
 */
export const forbiddenPackages = Effect.fn("forbiddenPackages")(function* (
	root: string,
	names: ReadonlyArray<string>,
) {
	const path = yield* Path.Path;
	const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
	const args = ["ls", "--recursive", "--depth", "-1", "--json"];
	const handle = yield* spawner.spawn(
		ChildProcess.make("pnpm", args, { cwd: root, stderr: "inherit" }),
	);
	const [stdout, exitCode] = yield* Effect.all(
		[handle.stdout.pipe(Stream.decodeText(), Stream.mkString), handle.exitCode],
		{ concurrency: "unbounded" },
	);
	if (exitCode !== ChildProcessSpawner.ExitCode(0)) {
		return yield* new WorkspaceError({
			message: `pnpm ${args.join(" ")} exited with ${exitCode}`,
		});
	}
	const workspace = yield* Schema.decodeEffect(PnpmList)(stdout);
	return names.map((name): ForbiddenPackage => {
		const found = workspace.find((pkg) => pkg.name === name);
		return {
			dir: found === undefined ? undefined : path.relative(root, found.path),
			name,
		};
	});
}, Effect.scoped);
