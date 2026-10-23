#!/usr/bin/env node
/**
 * Husky's `commit-msg` hook: checks the message file git passes as the first
 * argument, so a commit release-it would misread never reaches `main`.
 */
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Console, Effect, FileSystem } from "effect";

import { messageError, messageFromFile } from "../message.ts";

const program = Effect.gen(function* () {
	const file = process.argv[2];
	if (file === undefined) {
		return yield* Effect.fail("Usage: check-message.ts <commit message file>");
	}
	const fs = yield* FileSystem.FileSystem;
	const error = messageError(messageFromFile(yield* fs.readFileString(file)));
	if (error !== undefined) {
		yield* Console.error(error);
		return yield* Effect.fail("The commit message isn't valid");
	}
});

program.pipe(Effect.provide(NodeServices.layer), NodeRuntime.runMain);
