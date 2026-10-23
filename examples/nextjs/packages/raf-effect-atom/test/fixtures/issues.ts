import * as Effect from "effect/Effect";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import * as Schema from "effect/Schema";
import * as Rpc from "effect/rpc/Rpc";
import * as RpcGroup from "effect/rpc/RpcGroup";
import * as RpcTest from "effect/rpc/RpcTest";

import type { Handle } from "../../src/index.ts";

export class IssueNotFound extends Schema.TaggedError<IssueNotFound>()(
	"IssueNotFound",
	{ id: Schema.Int },
) {}

class Unauthorized extends Schema.TaggedError<Unauthorized>()("Unauthorized", {
	reason: Schema.String,
}) {}

const Issue = Schema.Struct({ id: Schema.Int, title: Schema.String });

const IssuesRpc = RpcGroup.make(
	Rpc.make("GetIssue", {
		error: Schema.Union([IssueNotFound, Unauthorized]),
		payload: { id: Schema.Int },
		success: Issue,
	}),
);

/** How the next `GetIssue` calls for an id end. */
export type Outcome = "crash" | "found" | "missing" | "signed-out";

const server = {
	outcomes: new Map<number, Array<Outcome>>(),
	requests: new Map<number, number>(),
};

const outcomeFor = (id: number): Outcome => {
	const queued = server.outcomes.get(id);
	return queued && queued.length > 1
		? queued.shift()!
		: (queued?.[0] ?? "found");
};

const handlers = IssuesRpc.toLayer({
	GetIssue: ({ id }) =>
		Effect.gen(function* () {
			server.requests.set(id, (server.requests.get(id) ?? 0) + 1);
			yield* Effect.sleep("5 millis");
			switch (outcomeFor(id)) {
				case "crash":
					return yield* Effect.die("the server crashed");
				case "missing":
					return yield* new IssueNotFound({ id });
				case "signed-out":
					return yield* new Unauthorized({ reason: "expired" });
				case "found":
					return { id, title: `Issue ${id}` };
			}
		}),
});

export class Issues extends AtomRpc.Service<Issues>()("Issues", {
	group: IssuesRpc,
	makeEffect: RpcTest.makeClient(IssuesRpc, { flatten: true }),
	protocol: handlers,
}) {}

/** A query atom that hydrates, as the example apps write them. */
export const issue = (id: number) =>
	Issues.query(
		"GetIssue",
		{ id },
		{ reactivityKeys: ["issues"], serializationKey: String(id) },
	);

/**
 * A handle to `issue(id)` whose result the browser doesn't have, as one the
 * server sends without its state, or after the registry dropped the result.
 */
export const unloaded = (id: number): Handle<typeof issue> => ({
	args: [id],
	key: `AtomRpc:GetIssue:${id}`,
});

/**
 * `Issues` again. Its queries have `issue`'s keys but are other atoms, as a
 * family member is once the garbage collector takes it and a read makes it
 * again.
 */
class Remade extends AtomRpc.Service<Remade>()("Remade", {
	group: IssuesRpc,
	makeEffect: RpcTest.makeClient(IssuesRpc, { flatten: true }),
	protocol: handlers,
}) {}

/** `issue(id)` made again: another atom with the same key. */
export const remadeIssue = (id: number) =>
	Remade.query(
		"GetIssue",
		{ id },
		{ reactivityKeys: ["issues"], serializationKey: String(id) },
	);

/** A query atom without a `serializationKey`, which never hydrates. */
export const unkeyedIssue = (id: number) => Issues.query("GetIssue", { id });

/** A plain effect atom, for the verbs outside RPC. */
export const counter = Atom.make(Effect.succeed(1));

/**
 * Serves `GetIssue` with the given outcomes per id (the last one repeats),
 * and counts its requests. Disposing it resets the server.
 */
export const serve = (
	outcomes: Record<number, ReadonlyArray<Outcome>> = {},
) => {
	for (const [id, queued] of Object.entries(outcomes)) {
		server.outcomes.set(Number(id), [...queued]);
	}
	return {
		requests: (id: number) => server.requests.get(id) ?? 0,
		[Symbol.dispose]: () => {
			server.outcomes.clear();
			server.requests.clear();
		},
	};
};
