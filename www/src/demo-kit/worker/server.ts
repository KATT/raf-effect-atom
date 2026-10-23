import { Authorization, CurrentUser, Latency } from "@examples/contract";
import { DbLatency, exampleUser, Issues } from "@examples/db";
import {
	Clock,
	Context,
	Effect,
	Layer,
	PubSub,
	Random,
	Ref,
	Schema,
	Stream,
} from "effect";
import type { Rpc } from "effect/rpc";

import {
	DemoControls,
	DemoRpcs,
	type InjectedError,
	InjectedFailure,
	initialLatency,
	RequestLog,
	ServerEvent,
} from "../rpcs.ts";

/**
 * What the control procedures change, for the middleware to read, and what
 * the middleware saw, for `ServerEvents`.
 */
class Controls extends Context.Service<
	Controls,
	{
		readonly events: PubSub.PubSub<ServerEvent>;
		readonly latency: Ref.Ref<number>;
		readonly queued: Ref.Ref<ReadonlyArray<InjectedError>>;
	}
>()("www/demo-kit/Controls") {
	static readonly layer = Layer.effect(
		Controls,
		Effect.all({
			events: PubSub.sliding<ServerEvent>(64),
			latency: Ref.make(initialLatency),
			queued: Ref.make<ReadonlyArray<InjectedError>>([]),
		}),
	);
}

const snapshot = (controls: Controls["Service"]) =>
	Effect.gen(function* () {
		return new DemoControls({
			latency: yield* Ref.get(controls.latency),
			queued: (yield* Ref.get(controls.queued)).map((error) => error.name),
		});
	});

const Handlers = DemoRpcs.toLayer(
	Effect.gen(function* () {
		const issues = yield* Issues;
		const controls = yield* Controls;

		return DemoRpcs.of({
			AddComment: (payload) =>
				Effect.flatMap(CurrentUser, (user) => issues.addComment(payload, user)),
			CountIssues: () => issues.count(),
			FailNext: (payload) =>
				Ref.update(controls.queued, (queued) => [
					...queued,
					...Array.from({ length: payload.count }, () => payload.error),
				]).pipe(Effect.andThen(snapshot(controls))),
			GetControls: () => snapshot(controls),
			GetIssue: (payload) => issues.get(payload.id),
			GetIssueAssignee: (payload) => issues.getAssignee(payload.issueId),
			ListComments: (payload) => issues.listComments(payload),
			ListIssues: (payload) => issues.list(payload),
			SearchIssues: (payload) => issues.search(payload.query),
			ServerEvents: () => Stream.fromPubSub(controls.events),
			SetLatency: (payload) =>
				Ref.set(controls.latency, payload.ms).pipe(
					Effect.andThen(snapshot(controls)),
				),
			SetStatus: (payload) => issues.setStatus(payload.id, payload.status),
			UpdateBody: (payload) => issues.updateBody(payload.id, payload.body),
			UpdateTitle: (payload) => issues.updateTitle(payload.id, payload.title),
		});
	}),
);

/**
 * The assignee comes from a slower service: it waits the latency once more
 * before the db's own wait, so it always settles after an issue started
 * beside it, and a loader that waits only for the issue streams it in.
 */
const slowerKey = DemoRpcs.requests.get("GetIssueAssignee")?.key;

/** The contract's `Latency`: the db waits what the toolbar set. */
const LatencyLayer = Layer.effect(
	Latency,
	Effect.gen(function* () {
		const controls = yield* Controls;
		return Latency.of((effect, options) =>
			Effect.flatMap(Ref.get(controls.latency), (ms) => {
				const timed = Effect.provideService(effect, DbLatency, ms);
				return options.rpc.key === slowerKey ? Effect.delay(timed, ms) : timed;
			}),
		);
	}),
);

/** The contract's `Authorization`: every request runs as the example user. */
const AuthorizationLayer = Layer.succeed(Authorization)(
	Authorization.of((effect) =>
		Effect.provideService(effect, CurrentUser, exampleUser),
	),
);

/** The errors a procedure can fail with: its own and its middleware's. */
const declaredBy = (rpc: Rpc.AnyWithProps) =>
	Schema.is(
		Schema.Union([
			rpc.errorSchema,
			...Array.from(rpc.middlewares, (middleware) => middleware.error),
		]),
	);

const InjectedFailureLayer = Layer.effect(
	InjectedFailure,
	Effect.gen(function* () {
		const controls = yield* Controls;
		const publish = (phase: ServerEvent["phase"], requestId: string) =>
			Effect.gen(function* () {
				yield* PubSub.publish(
					controls.events,
					new ServerEvent({
						at: yield* Clock.currentTimeMillis,
						latency: yield* Ref.get(controls.latency),
						phase,
						requestId,
					}),
				);
			});
		return InjectedFailure.of((effect, options) => {
			const requestId = String(options.requestId);
			const handled = Effect.gen(function* () {
				const next = yield* Ref.modify(
					controls.queued,
					([first, ...rest]) => [first, rest] as const,
				);
				if (next === undefined) {
					return yield* effect;
				}
				const ms = yield* Ref.get(controls.latency);
				yield* Effect.sleep(ms * (yield* Random.nextBetween(0.5, 1.5)));
				if (declaredBy(options.rpc)(next)) {
					// SAFETY: the server encodes a failure with the procedure's
					// error Schemas, and `declaredBy` checked it's one of them.
					const declared = next as never;
					return yield* Effect.fail(declared);
				}
				return yield* Effect.die(next);
			});
			return publish("received", requestId).pipe(
				Effect.andThen(handled),
				Effect.ensuring(publish("responded", requestId)),
			);
		});
	}),
);

const RequestLogLayer = Layer.succeed(RequestLog)(
	RequestLog.of((effect) => effect),
);

/**
 * The demo's server: the contract's procedures over a freshly seeded example
 * db, with the controls' middleware. Each worker builds its own.
 */
export const ServerLayer = Layer.mergeAll(
	Handlers,
	LatencyLayer,
	AuthorizationLayer,
	InjectedFailureLayer,
	RequestLogLayer,
).pipe(Layer.provide([Controls.layer, Issues.layerTest]));
