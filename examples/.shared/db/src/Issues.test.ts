import {
	CommentId,
	EmptyComment,
	EmptyTitle,
	IssueId,
	IssueNotFound,
} from "@examples/contract";
import { assert, describe, it } from "@effect/vitest";
import { ConfigProvider, DateTime, Effect, Fiber, Layer } from "effect";
import { TestClock } from "effect/testing";

import { DbLatency, Issues } from "./Issues.ts";
import { exampleUser } from "./seed.ts";

const TestLayer = Layer.merge(Issues.layerTest, Layer.succeed(DbLatency)(0));

const commentId = CommentId.make("6f1c2b0e-8a4d-4c39-9d2e-3b5a7c1e0f42");

describe("Issues", () => {
	it.effect("pages through the issues, newest first by default", () =>
		Effect.gen(function* () {
			const issues = yield* Issues;
			const first = yield* issues.list({
				cursor: 0,
				sort: "newest",
				status: "all",
			});
			assert.strictEqual(first.total, 42);
			assert.strictEqual(first.issues.length, 10);
			assert.strictEqual(first.nextCursor, 10);
			assert.isTrue(
				DateTime.isGreaterThan(
					first.issues[0]!.createdAt,
					first.issues[1]!.createdAt,
				),
			);

			const last = yield* issues.list({
				cursor: 40,
				sort: "newest",
				status: "all",
			});
			assert.strictEqual(last.issues.length, 2);
			assert.isNull(last.nextCursor);
		}).pipe(Effect.provide(TestLayer)),
	);

	it.effect("searches titles ignoring case, newest first, up to a page", () =>
		Effect.gen(function* () {
			const issues = yield* Issues;
			const found = yield* issues.search("STALE COUNT");
			assert.isAbove(found.length, 0);
			assert.isAtMost(found.length, 10);
			assert.isTrue(
				found.every((issue) =>
					issue.title.toLowerCase().includes("stale count"),
				),
			);
			assert.isTrue(
				found.every(
					(issue, index) =>
						index === 0 ||
						DateTime.isLessThanOrEqualTo(
							issue.createdAt,
							found[index - 1]!.createdAt,
						),
				),
			);
			assert.deepStrictEqual(yield* issues.search("  "), []);
		}).pipe(Effect.provide(TestLayer)),
	);

	it.effect("filters by status and sorts oldest first", () =>
		Effect.gen(function* () {
			const issues = yield* Issues;
			const counts = yield* issues.count();
			const open = yield* issues.list({
				cursor: 0,
				sort: "oldest",
				status: "open",
			});
			assert.strictEqual(open.total, counts.open);
			assert.isTrue(open.issues.every((issue) => issue.status === "open"));
			assert.isTrue(
				DateTime.isLessThan(
					open.issues[0]!.createdAt,
					open.issues[1]!.createdAt,
				),
			);
			assert.strictEqual(
				counts.open + counts.in_progress + counts.closed,
				counts.all,
			);
		}).pipe(Effect.provide(TestLayer)),
	);

	it.effect("fails with IssueNotFound for a missing issue", () =>
		Effect.gen(function* () {
			const issues = yield* Issues;
			const missing = IssueId.make(999);
			assert.deepStrictEqual(
				yield* issues.get(missing).pipe(Effect.flip),
				new IssueNotFound({ id: missing }),
			);
			assert.deepStrictEqual(
				yield* issues
					.listComments({ cursor: 0, issueId: missing })
					.pipe(Effect.flip),
				new IssueNotFound({ id: missing }),
			);
		}).pipe(Effect.provide(TestLayer)),
	);

	it.effect("saves a trimmed title and rejects an empty one", () =>
		Effect.gen(function* () {
			const issues = yield* Issues;
			const id = IssueId.make(1);
			const updated = yield* issues.updateTitle(id, "  Renamed  ");
			assert.strictEqual(updated.title, "Renamed");
			assert.strictEqual((yield* issues.get(id)).title, "Renamed");
			assert.instanceOf(
				yield* issues.updateTitle(id, "   ").pipe(Effect.flip),
				EmptyTitle,
			);
		}).pipe(Effect.provide(TestLayer)),
	);

	it.effect("adds a comment once per id, newest first", () =>
		Effect.gen(function* () {
			const issues = yield* Issues;
			const issueId = IssueId.make(1);
			const before = yield* issues.get(issueId);
			const input = { body: " First! ", id: commentId, issueId };

			const added = yield* issues.addComment(input, exampleUser);
			const again = yield* issues.addComment(input, exampleUser);
			assert.strictEqual(added.body, "First!");
			assert.deepStrictEqual(again, added);

			const page = yield* issues.listComments({ cursor: 0, issueId });
			assert.deepStrictEqual(page.comments[0], added);
			assert.strictEqual(page.total, before.commentCount + 1);
			assert.strictEqual(
				(yield* issues.get(issueId)).commentCount,
				before.commentCount + 1,
			);
		}).pipe(Effect.provide(TestLayer)),
	);

	it.effect("rejects an empty comment", () =>
		Effect.gen(function* () {
			const issues = yield* Issues;
			const error = yield* issues
				.addComment(
					{ body: "  ", id: commentId, issueId: IssueId.make(1) },
					exampleUser,
				)
				.pipe(Effect.flip);
			assert.instanceOf(error, EmptyComment);
		}).pipe(Effect.provide(TestLayer)),
	);

	it.effect("waits the request's latency, ± 50%", () =>
		Effect.gen(function* () {
			const issues = yield* Issues;
			const fiber = yield* issues
				.get(IssueId.make(1))
				.pipe(Effect.provideService(DbLatency, 1000), Effect.forkChild);
			yield* TestClock.adjust(499);
			assert.isUndefined(fiber.pollUnsafe());
			yield* TestClock.adjust(1001);
			assert.strictEqual((yield* Fiber.join(fiber)).id, 1);
		}).pipe(Effect.provide(Issues.layerTest)),
	);

	it.effect("defaults to DB_LATENCY_MS", () =>
		Effect.gen(function* () {
			const issues = yield* Issues;
			assert.strictEqual((yield* issues.get(IssueId.make(1))).id, 1);
		}).pipe(
			Effect.provide(
				Issues.layerTest.pipe(
					Layer.provide(
						ConfigProvider.layer(
							ConfigProvider.fromUnknown({ DB_LATENCY_MS: "0" }),
						),
					),
				),
			),
		),
	);
});
