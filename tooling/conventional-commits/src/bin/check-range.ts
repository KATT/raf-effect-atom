#!/usr/bin/env node
/**
 * Checks every commit a push to `main` brought: `COMMITS_BEFORE..COMMITS_AFTER`
 * (the push event's `before` and `after`). Exits 1 when a subject isn't a
 * conventional commit.
 */
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Config, Console, Effect } from "effect";

import { invalidCommits } from "../commits.ts";
import { formatError } from "../validate.ts";

const program = Effect.gen(function* () {
	const before = yield* Config.String("COMMITS_BEFORE").pipe(
		Config.withDefault(""),
	);
	const after = yield* Config.String("COMMITS_AFTER").pipe(
		Config.withDefault("HEAD"),
	);
	const invalid = yield* invalidCommits(process.cwd(), before, after);
	if (invalid.length === 0) {
		return yield* Console.log("Every pushed commit subject is conventional.");
	}
	for (const commit of invalid) {
		yield* Console.error(
			`${commit.sha.slice(0, 12)} ${formatError(commit.subject, commit.reason)}\n`,
		);
	}
	return yield* Effect.fail(
		`${invalid.length} commit subject(s) aren't conventional`,
	);
});

program.pipe(Effect.provide(NodeServices.layer), NodeRuntime.runMain);
