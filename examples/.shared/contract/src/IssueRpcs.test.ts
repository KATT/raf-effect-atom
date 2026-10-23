import { assert, describe, it } from "@effect/vitest";
import { DateTime, Effect, Exit, Option, Schema } from "effect";
import { Rpc } from "effect/rpc";

import { Unauthorized } from "./Authorization.ts";
import { Issue, IssueId, UserId } from "./Issue.ts";
import { EmptyTitle, IssueNotFound } from "./IssueErrors.ts";
import { IssueRpcs } from "./IssueRpcs.ts";
import { decodeLatencyCookie } from "./Latency.ts";

/** What an exit looks like after the wire: JSON text, decoded again. */
const overTheWire = Effect.fnUntraced(function* (
	tag: "AddComment" | "GetIssue",
	exit: Exit.Exit<unknown, unknown>,
) {
	const rpc = IssueRpcs.requests.get(tag);
	assert.isDefined(rpc);
	const codec = Schema.toCodecJson(Rpc.exitSchema(rpc));
	const json = JSON.stringify(yield* Schema.encodeUnknownEffect(codec)(exit));
	return yield* Schema.decodeUnknownEffect(codec)(JSON.parse(json));
});

describe("IssueRpcs", () => {
	it.effect("decodes a success back into its class, dates included", () =>
		Effect.gen(function* () {
			const issue = new Issue({
				assigneeId: UserId.make("ada"),
				body: "Steps",
				commentCount: 0,
				createdAt: DateTime.makeUnsafe("2026-01-05T00:00:00Z"),
				id: IssueId.make(7),
				status: "open",
				title: "Login form loses input",
			});
			const exit = yield* overTheWire("GetIssue", Exit.succeed(issue));
			assert.isTrue(Exit.isSuccess(exit));
			if (Exit.isSuccess(exit)) {
				assert.instanceOf(exit.value, Issue);
				assert.deepStrictEqual(exit.value, issue);
			}
		}),
	);

	it.effect("decodes a procedure's own error back into its class", () =>
		Effect.gen(function* () {
			const exit = yield* overTheWire(
				"GetIssue",
				Exit.fail(new IssueNotFound({ id: IssueId.make(7) })),
			);
			const error = Option.getOrThrow(Exit.findErrorOption(exit));
			assert.instanceOf(error, IssueNotFound);
			assert.deepStrictEqual(error, new IssueNotFound({ id: IssueId.make(7) }));
		}),
	);

	it.effect("decodes Authorization's Unauthorized on every procedure", () =>
		Effect.gen(function* () {
			const exit = yield* overTheWire(
				"AddComment",
				Exit.fail(new Unauthorized()),
			);
			assert.instanceOf(
				Option.getOrThrow(Exit.findErrorOption(exit)),
				Unauthorized,
			);
		}),
	);

	it.effect("rejects an error the procedure doesn't declare", () =>
		Effect.gen(function* () {
			const error = yield* overTheWire(
				"GetIssue",
				Exit.fail(new EmptyTitle()),
			).pipe(Effect.flip);
			assert.isTrue(Schema.isSchemaError(error));
		}),
	);
});

describe("decodeLatencyCookie", () => {
	it("accepts only the menu's choices", () => {
		assert.deepStrictEqual(decodeLatencyCookie("400"), Option.some(400));
		assert.deepStrictEqual(decodeLatencyCookie("0"), Option.some(0));
		assert.isTrue(Option.isNone(decodeLatencyCookie("250")));
		assert.isTrue(Option.isNone(decodeLatencyCookie("fast")));
		assert.isTrue(Option.isNone(decodeLatencyCookie(undefined)));
	});
});
