import { Data, Effect, Stream, String as Str } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";

import { messageError } from "./message.ts";

class GitError extends Data.TaggedError("GitError")<{
	readonly args: ReadonlyArray<string>;
	readonly exitCode: number;
}> {
	override get message() {
		return `git ${this.args.join(" ")} exited with ${this.exitCode}`;
	}
}

/** Runs git in `cwd` and returns its stdout. Fails on a non-zero exit. */
export const git = Effect.fn("git")(function* (
	cwd: string,
	...args: ReadonlyArray<string>
) {
	const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
	const handle = yield* spawner.spawn(
		ChildProcess.make("git", args, { cwd, stderr: "inherit" }),
	);
	const [stdout, exitCode] = yield* Effect.all(
		[handle.stdout.pipe(Stream.decodeText(), Stream.mkString), handle.exitCode],
		{ concurrency: "unbounded" },
	);
	if (exitCode !== ChildProcessSpawner.ExitCode(0)) {
		return yield* new GitError({ args, exitCode });
	}
	return stdout;
}, Effect.scoped);

/** What a push of a new branch reports as the commit before it. */
const noCommit = /^0+$/;

interface Commit {
	readonly message: string;
	readonly sha: string;
	readonly subject: string;
}

/**
 * The commits a push brought, oldest first: `before..after`, or only `after`
 * when `before` is empty or all zeros (a new branch, or a manual run).
 *
 * Only `main`'s own line counts (`--first-parent`, no merges): vendor-src's
 * `git subtree` imports merge in an upstream "Squashed '<dir>/' content"
 * commit that release-it never reads, since it touches only `.repos/`.
 */
export const pushedCommits = Effect.fn("pushedCommits")(function* (
	cwd: string,
	before: string,
	after: string,
) {
	const range =
		before === "" || noCommit.test(before)
			? ["-1", after]
			: [`${before}..${after}`];
	const output = yield* git(
		cwd,
		"log",
		"-z",
		"--reverse",
		"--first-parent",
		"--no-merges",
		"--format=%H%n%B",
		...range,
	);
	return output
		.split("\0")
		.filter((record) => record.trim() !== "")
		.map((record): Commit => {
			const [sha = "", ...lines] = record.split("\n");
			const message = Str.trimEnd(lines.join("\n"));
			return { message, sha, subject: lines[0] ?? "" };
		});
});

/** The pushed commits whose messages don't pass, with the error to show. */
export const invalidCommits = Effect.fn("invalidCommits")(function* (
	cwd: string,
	before: string,
	after: string,
) {
	const commits = yield* pushedCommits(cwd, before, after);
	return commits.flatMap((commit) => {
		const error = messageError(commit.message);
		return error === undefined ? [] : [{ ...commit, error }];
	});
});
