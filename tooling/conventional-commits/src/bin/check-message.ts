#!/usr/bin/env node
/**
 * Husky's `commit-msg` hook: checks the subject of the message file git passes
 * as the first argument, so a non-conventional commit never reaches `main`.
 */
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Console, Effect, FileSystem } from "effect";

import { formatError, validateSubject } from "../validate.ts";

const program = Effect.gen(function* () {
	const file = process.argv[2];
	if (file === undefined) {
		return yield* Effect.fail("Usage: check-message.ts <commit message file>");
	}
	const fs = yield* FileSystem.FileSystem;
	const message = yield* fs.readFileString(file);
	const subject =
		message.split("\n").find((line) => !line.startsWith("#")) ?? "";
	const result = validateSubject(subject);
	if (!result.ok) {
		yield* Console.error(formatError(subject, result.reason));
		return yield* Effect.fail("The commit subject isn't conventional");
	}
});

program.pipe(Effect.provide(NodeServices.layer), NodeRuntime.runMain);
