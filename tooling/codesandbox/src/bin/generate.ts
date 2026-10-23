#!/usr/bin/env node
/**
 * Writes the standalone example copies into <dir>, to try one locally:
 * `cd <dir>/examples/nextjs && pnpm install && pnpm dev`.
 *
 * Usage: pnpm --filter @tooling/codesandbox generate <dir>
 */
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Config, Console, Effect, Path } from "effect";

import { writeCopies } from "../copies.ts";

Effect.gen(function* () {
	const path = yield* Path.Path;
	const dir = process.argv[2];
	if (dir === undefined) {
		return yield* Effect.die(
			"Usage: pnpm --filter @tooling/codesandbox generate <dir>",
		);
	}
	// pnpm runs the script in this package; `INIT_CWD` is where it was called.
	const cwd = yield* Config.String("INIT_CWD").pipe(
		Config.withDefault(process.cwd()),
	);
	const out = path.resolve(cwd, dir);
	yield* writeCopies(path.join(import.meta.dirname, "../../../.."), out);
	yield* Console.log(`Wrote the examples to ${out}`);
}).pipe(Effect.provide(NodeServices.layer), NodeRuntime.runMain);
