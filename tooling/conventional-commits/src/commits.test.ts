import { NodeServices } from "@effect/platform-node";
import { assert, describe, it } from "@effect/vitest";
import { Effect, FileSystem, String as Str } from "effect";

import { git, invalidCommits, pushedCommits } from "./commits.ts";

const commit = Effect.fn("commit")(function* (root: string, message: string) {
	yield* git(
		root,
		"-c",
		"user.name=Test",
		"-c",
		"user.email=test@example.com",
		"-c",
		"commit.gpgsign=false",
		"commit",
		"--quiet",
		"--allow-empty",
		"--message",
		message,
	);
	return Str.trim(yield* git(root, "rev-parse", "HEAD"));
});

const repo = Effect.gen(function* () {
	const fs = yield* FileSystem.FileSystem;
	const root = yield* fs.makeTempDirectoryScoped();
	yield* git(root, "init", "--quiet", "--initial-branch", "main");
	return root;
});

describe("pushedCommits", () => {
	it.effect("lists before..after, oldest first", () =>
		Effect.gen(function* () {
			const root = yield* repo;
			const before = yield* commit(root, "Initial commit");
			yield* commit(root, "feat: one");
			const after = yield* commit(root, "fix: two");
			const commits = yield* pushedCommits(root, before, after);
			assert.deepStrictEqual(
				commits.map((entry) => entry.subject),
				["feat: one", "fix: two"],
			);
		}).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
	);

	it.effect("skips a subtree merge and the commit it merges in", () =>
		Effect.gen(function* () {
			const root = yield* repo;
			const before = yield* commit(root, "Initial commit");
			yield* git(root, "checkout", "--quiet", "--orphan", "upstream");
			yield* commit(root, "Squashed '.repos/effect/' content");
			yield* git(root, "checkout", "--quiet", "main");
			yield* git(
				root,
				"-c",
				"user.name=Test",
				"-c",
				"user.email=test@example.com",
				"merge",
				"--quiet",
				"--allow-unrelated-histories",
				"--message",
				"Merge commit 'abc' as '.repos/effect'",
				"upstream",
			);
			const after = yield* commit(root, "chore(vendor): vendor effect");
			const commits = yield* pushedCommits(root, before, after);
			assert.deepStrictEqual(
				commits.map((entry) => entry.subject),
				["chore(vendor): vendor effect"],
			);
		}).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
	);

	it.effect("checks only the tip when there is no commit before", () =>
		Effect.gen(function* () {
			const root = yield* repo;
			yield* commit(root, "Initial commit");
			const after = yield* commit(root, "feat: tip");
			const commits = yield* pushedCommits(root, "0".repeat(40), after);
			assert.deepStrictEqual(
				commits.map((entry) => entry.subject),
				["feat: tip"],
			);
		}).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
	);
});

describe("invalidCommits", () => {
	it.effect("reports each non-conventional subject in the push", () =>
		Effect.gen(function* () {
			const root = yield* repo;
			const before = yield* commit(root, "Initial commit");
			yield* commit(root, "feat: fine");
			const bad = yield* commit(root, "Update stuff");
			const invalid = yield* invalidCommits(root, before, bad);
			assert.deepStrictEqual(
				invalid.map((entry) => [entry.sha, entry.subject]),
				[[bad, "Update stuff"]],
			);
		}).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
	);

	it.effect("fails when a commit in the range is missing", () =>
		Effect.gen(function* () {
			const root = yield* repo;
			const after = yield* commit(root, "feat: tip");
			const error = yield* Effect.flip(
				invalidCommits(root, "1".repeat(40), after),
			);
			assert.strictEqual(error._tag, "GitError");
		}).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
	);
});
