import { NodeHttpServer } from "@effect/platform-node";
import {
	CommentId,
	EmptyTitle,
	Issue,
	IssueId,
	IssueNotFound,
	IssueRpcs,
	LATENCY_COOKIE,
	SESSION_COOKIE,
	SIGNED_OUT,
	Unauthorized,
} from "@examples/contract";
import { exampleUser, Issues } from "@examples/db";
import { assert, describe, it } from "@effect/vitest";
import { Clock, Effect, Layer } from "effect";
import { HttpClient, HttpClientRequest, HttpRouter } from "effect/http";
import { RpcClient, RpcSerialization } from "effect/rpc";

import { RPC_PATH, RpcRoutesNoDeps } from "./RpcRoutes.ts";

const Server = HttpRouter.serve(RpcRoutesNoDeps, {
	disableListenLog: true,
	disableLogger: true,
}).pipe(Layer.provide(Issues.layerTest));

/** A client over real HTTP and JSON, sending `cookie` as a browser would. */
const ClientProtocol = (cookie: string) =>
	RpcClient.layerProtocolHttp({
		transformClient: HttpClient.mapRequest((request) =>
			request.pipe(
				HttpClientRequest.appendUrl(RPC_PATH),
				HttpClientRequest.setHeader("cookie", cookie),
			),
		),
		url: "",
	}).pipe(
		Layer.provideMerge(Server),
		Layer.provide([NodeHttpServer.layerTest, RpcSerialization.layerJson]),
	);

const SignedIn = ClientProtocol(`${LATENCY_COOKIE}=0`);

describe("RpcRoutes", () => {
	it.effect("returns an issue as its class", () =>
		Effect.gen(function* () {
			const client = yield* RpcClient.make(IssueRpcs);
			const issue = yield* client.GetIssue({ id: IssueId.make(1) });
			assert.instanceOf(issue, Issue);
			assert.strictEqual(issue.id, 1);
		}).pipe(Effect.provide(SignedIn)),
	);

	it.effect("fails with the procedure's own error, decoded", () =>
		Effect.gen(function* () {
			const client = yield* RpcClient.make(IssueRpcs);
			const missing = IssueId.make(999);
			const error = yield* client.GetIssue({ id: missing }).pipe(Effect.flip);
			assert.instanceOf(error, IssueNotFound);
			assert.deepStrictEqual(error, new IssueNotFound({ id: missing }));
		}).pipe(Effect.provide(SignedIn)),
	);

	it.effect("fails every procedure with Unauthorized when signed out", () =>
		Effect.gen(function* () {
			const client = yield* RpcClient.make(IssueRpcs);
			assert.instanceOf(
				yield* client.CountIssues().pipe(Effect.flip),
				Unauthorized,
			);
			assert.instanceOf(
				yield* client.GetIssue({ id: IssueId.make(1) }).pipe(Effect.flip),
				Unauthorized,
			);
		}).pipe(
			Effect.provide(
				ClientProtocol(`${LATENCY_COOKIE}=0; ${SESSION_COOKIE}=${SIGNED_OUT}`),
			),
		),
	);

	it.effect("saves a title, and rejects an empty one", () =>
		Effect.gen(function* () {
			const client = yield* RpcClient.make(IssueRpcs);
			const id = IssueId.make(1);
			yield* client.UpdateTitle({ id, title: "Renamed" });
			assert.strictEqual((yield* client.GetIssue({ id })).title, "Renamed");
			assert.instanceOf(
				yield* client.UpdateTitle({ id, title: " " }).pipe(Effect.flip),
				EmptyTitle,
			);
		}).pipe(Effect.provide(SignedIn)),
	);

	it.effect("adds a comment once, as the signed-in user", () =>
		Effect.gen(function* () {
			const client = yield* RpcClient.make(IssueRpcs);
			const input = {
				body: "On it",
				id: CommentId.make("6f1c2b0e-8a4d-4c39-9d2e-3b5a7c1e0f42"),
				issueId: IssueId.make(2),
			};
			const added = yield* client.AddComment(input);
			assert.deepStrictEqual(yield* client.AddComment(input), added);
			assert.deepStrictEqual(added.author, exampleUser);

			const page = yield* client.ListComments({
				cursor: 0,
				issueId: input.issueId,
			});
			assert.deepStrictEqual(page.comments[0], added);
			assert.strictEqual(
				page.comments.filter((comment) => comment.id === input.id).length,
				1,
			);
		}).pipe(Effect.provide(SignedIn)),
	);

	it.effect("pages through the issues", () =>
		Effect.gen(function* () {
			const client = yield* RpcClient.make(IssueRpcs);
			const first = yield* client.ListIssues({
				cursor: 0,
				sort: "newest",
				status: "all",
			});
			assert.strictEqual(first.total, 42);
			assert.strictEqual(first.nextCursor, 10);
			const second = yield* client.ListIssues({
				cursor: 10,
				sort: "newest",
				status: "all",
			});
			const firstIds = new Set(first.issues.map((issue) => issue.id));
			assert.isFalse(second.issues.some((issue) => firstIds.has(issue.id)));
		}).pipe(Effect.provide(SignedIn)),
	);

	// Live: the request crosses a real socket before the db sleeps, so a
	// TestClock adjustment could land before the sleep starts.
	it.live("waits the latency the cookie asks for", () =>
		Effect.gen(function* () {
			const client = yield* RpcClient.make(IssueRpcs);
			const startedAt = yield* Clock.currentTimeMillis;
			yield* client.GetIssue({ id: IssueId.make(1) });
			const elapsed = (yield* Clock.currentTimeMillis) - startedAt;
			assert.isAtLeast(elapsed, 50);
		}).pipe(Effect.provide(ClientProtocol(`${LATENCY_COOKIE}=100`))),
	);
});
