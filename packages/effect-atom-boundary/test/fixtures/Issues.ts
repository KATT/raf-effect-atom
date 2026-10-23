import * as Effect from "effect/Effect";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import * as Schema from "effect/Schema";
import * as Rpc from "effect/rpc/Rpc";
import * as RpcGroup from "effect/rpc/RpcGroup";
import * as RpcTest from "effect/rpc/RpcTest";

class IssueNotFound extends Schema.TaggedError<IssueNotFound>()(
	"IssueNotFound",
	{ id: Schema.Int },
) {}

class Unauthorized extends Schema.TaggedError<Unauthorized>()("Unauthorized", {
	reason: Schema.String,
}) {}

class Offline extends Schema.TaggedError<Offline>()("Offline", {}) {}

class UserNotFound extends Schema.TaggedError<UserNotFound>()("UserNotFound", {
	name: Schema.String,
}) {}

const Issue = Schema.Struct({ id: Schema.Int, title: Schema.String });

const IssuesRpc = RpcGroup.make(
	Rpc.make("GetIssue", {
		error: Schema.Union([IssueNotFound, Unauthorized, Offline]),
		payload: { id: Schema.Int },
		success: Issue,
	}),
	Rpc.make("GetUser", {
		error: UserNotFound,
		payload: { name: Schema.String },
		success: Schema.String,
	}),
);

/** How the next `GetIssue` calls for an id end. */
export type Outcome = "crash" | "found" | "missing" | "offline" | "signed-out";

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
				case "offline":
					return yield* new Offline();
				case "signed-out":
					return yield* new Unauthorized({ reason: "expired" });
				case "found":
					return { id, title: `Issue ${id}` };
			}
		}),
	GetUser: (payload) => Effect.fail(new UserNotFound({ name: payload.name })),
});

export class Issues extends AtomRpc.Service<Issues>()("Issues", {
	group: IssuesRpc,
	makeEffect: RpcTest.makeClient(IssuesRpc, { flatten: true }),
	protocol: handlers,
}) {}

export const issue = (id: number) => Issues.query("GetIssue", { id });

/**
 * `issue` with a serialization key that keeps its hydrated value on its
 * first read, as `raf-effect-atom`'s `hydrated` copy does.
 */
export const hydratedIssue = Atom.family((id: number) => {
	const atom = Issues.query(
		"GetIssue",
		{ id },
		{ serializationKey: String(id) },
	);
	if (!Atom.isSerializable(atom)) {
		return atom;
	}
	// SAFETY: a copy of `atom` with the same prototype and fields, as
	// `Atom.serializable` makes its own.
	const copy = Object.assign(Object.create(Object.getPrototypeOf(atom)), {
		...atom,
		[Atom.SerializableTypeId]: {
			...atom[Atom.SerializableTypeId],
			skipInitialRun: true,
		},
	}) as typeof atom;
	return copy;
});

export const user = (name: string) => Issues.query("GetUser", { name });

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
