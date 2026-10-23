import { BrowserWorker } from "@effect/platform-browser";
import { Effect, Exit, Layer, Option, Predicate, Schema, Stream } from "effect";
import {
	Atom,
	AsyncResult,
	type AtomRegistry,
	AtomRpc,
} from "effect/reactivity";
import { Rpc, RpcClient, type RpcMessage, RpcMiddleware } from "effect/rpc";
import { Worker as Workers } from "effect/workers";

import {
	controlTags,
	DemoRpcs,
	type InjectedError,
	RequestLog,
	type ServerEvent,
} from "./rpcs.ts";
import {
	failureOf,
	type Outcome,
	requestsAtom,
	type TracedRequest,
} from "./trace.ts";

const maxRequests = 30;

const outcomeOf = (exit: Exit.Exit<unknown, unknown>): Outcome =>
	Exit.match(exit, {
		onFailure: failureOf,
		onSuccess: () => ({ status: "success" }),
	});

/**
 * The demo's request trace, written to {@link requestsAtom} in its registry:
 * the client middleware adds a request as it's sent, the worker's
 * `ServerEvents` say when its server received and answered it, and the
 * protocol settles it when its exit arrives. The control procedures are left
 * out.
 */
class Log {
	readonly #registry: AtomRegistry.AtomRegistry;
	/** The procedure of each logged request still in flight, by request id. */
	readonly #inFlight = new Map<string, string>();

	constructor(registry: AtomRegistry.AtomRegistry) {
		this.#registry = registry;
	}

	start(request: RpcMessage.Request<Rpc.Any>) {
		if (controlTags.has(request.tag)) {
			return;
		}
		const id = String(request.id);
		this.#inFlight.set(id, request.tag);
		const entry: TracedRequest = {
			endedAt: undefined,
			id,
			label: `${request.tag} ${JSON.stringify(request.payload)}`,
			latency: undefined,
			outcome: undefined,
			receivedAt: undefined,
			respondedAt: undefined,
			sentAt: Date.now(),
		};
		this.#registry.update(requestsAtom, (requests) => [
			...requests.slice(1 - maxRequests),
			entry,
		]);
	}

	server(event: ServerEvent) {
		this.#update(event.requestId, (request) =>
			event.phase === "received"
				? { ...request, latency: event.latency, receivedAt: event.at }
				: { ...request, respondedAt: event.at },
		);
	}

	/** Decodes the exit with the procedure's own Schemas, as the client does. */
	exit(response: RpcMessage.ResponseExitEncoded) {
		const requestId = String(response.requestId);
		const tag = this.#inFlight.get(requestId);
		const rpc = tag === undefined ? undefined : DemoRpcs.requests.get(tag);
		if (rpc === undefined) {
			return;
		}
		const decode = Schema.decodeUnknownOption(
			Schema.toCodecJson(Rpc.exitSchema(rpc)),
		);
		Option.map(decode(response.exit), (exit) => {
			this.#settle(requestId, outcomeOf(exit));
		});
		// A consumed failure leaves the queue: show the new count.
		const controls = AsyncResult.value(this.#registry.get(controlsAtom));
		if (Option.isSome(controls) && controls.value.queued.length > 0) {
			this.#registry.refresh(controlsAtom);
		}
	}

	/** A fatal defect from the server fails every request in flight. */
	defect() {
		for (const id of this.#inFlight.keys()) {
			this.#settle(id, { status: "defect" });
		}
	}

	interrupt(requestId: string) {
		if (this.#inFlight.has(requestId)) {
			this.#settle(requestId, { status: "interrupted" });
		}
	}

	#settle(id: string, outcome: Outcome) {
		this.#inFlight.delete(id);
		this.#update(id, (request) =>
			request.outcome === undefined
				? { ...request, endedAt: Date.now(), outcome }
				: request,
		);
	}

	#update(id: string, f: (request: TracedRequest) => TracedRequest) {
		this.#registry.update(requestsAtom, (requests) =>
			requests.map((request) => (request.id === id ? f(request) : request)),
		);
	}
}

const logs = new WeakMap<AtomRegistry.AtomRegistry, Log>();

const logFor = (registry: AtomRegistry.AtomRegistry) => {
	const existing = logs.get(registry);
	if (existing !== undefined) {
		return existing;
	}
	const log = new Log(registry);
	logs.set(registry, log);
	return log;
};

/**
 * Spawns the demo's worker, and terminates it with the client's scope: a
 * dedicated worker otherwise outlives the layer.
 */
const spawnerLayer = Layer.unwrap(
	Effect.gen(function* () {
		const workers = new Set<Worker>();
		yield* Effect.addFinalizer(() =>
			Effect.sync(() => {
				for (const worker of workers) {
					worker.terminate();
				}
			}),
		);
		return Workers.layerSpawner(() => {
			const worker = new Worker(new URL("worker/main.ts", import.meta.url), {
				name: "demo server",
				type: "module",
			});
			workers.add(worker);
			return worker;
		});
	}),
);

/**
 * The worker protocol, with each exit and interrupt read on the way: client
 * middleware sees a request leave, not how it ended.
 */
const protocolLayer = (log: Log) =>
	Layer.effect(
		RpcClient.Protocol,
		Effect.gen(function* () {
			const protocol = yield* RpcClient.Protocol;
			return RpcClient.Protocol.of({
				...protocol,
				run: (clientId, onResponse) =>
					protocol.run(clientId, (response) =>
						Effect.suspend(() => {
							if (Predicate.isTagged(response, "Exit")) {
								log.exit(response);
							} else if (Predicate.isTagged(response, "Defect")) {
								log.defect();
							}
							return onResponse(response);
						}),
					),
				send: (clientId, request, transferables) =>
					Effect.suspend(() => {
						if (Predicate.isTagged(request, "Interrupt")) {
							log.interrupt(String(request.requestId));
						}
						return protocol.send(clientId, request, transferables);
					}),
			});
		}),
	).pipe(
		// A request holds its worker until it ends, and the pool lends a worker
		// to one request at a time by default: concurrent requests would run
		// one after another, and `ServerEvents`, which never ends, would block
		// the rest.
		Layer.provide(
			RpcClient.layerProtocolWorker({ concurrency: 1000, size: 1 }),
		),
		Layer.provide([BrowserWorker.layerPlatform, spawnerLayer]),
	);

/** The client's part of {@link RequestLog}. */
const requestLogLayer = (log: Log) =>
	RpcMiddleware.layerClient(RequestLog, (options) =>
		Effect.suspend(() => {
			log.start(options.request);
			return options.next(options.request);
		}),
	);

/**
 * The demos' RPC client: the contract's procedures and the demo kit's
 * controls, served by a worker of its own in each demo's registry.
 */
export class IssuesClient extends AtomRpc.Service<IssuesClient>()(
	"IssuesClient",
	{
		group: DemoRpcs,
		protocol: (get) => {
			const log = logFor(get.registry);
			return Layer.merge(requestLogLayer(log), protocolLayer(log));
		},
	},
) {}

const controlsKey = "demo-kit:controls";

/**
 * Feeds the worker's `ServerEvents` to the request trace while mounted. The
 * demo frame mounts it for the session.
 */
export const serverEventsAtom = IssuesClient.runtime
	.atom((get) => {
		const log = logFor(get.registry);
		return Effect.gen(function* () {
			const client = yield* IssuesClient;
			yield* Stream.runForEach(client("ServerEvents", undefined), (event) =>
				Effect.sync(() => {
					log.server(event);
				}),
			);
		});
	})
	.pipe(Atom.keepAlive, Atom.withLabel("demo-kit:server-events"));

/** The demo server's latency and queued failures. */
export const controlsAtom = IssuesClient.query("GetControls", undefined, {
	reactivityKeys: [controlsKey],
});

/** Sets how long the demo server takes to answer, in ms. */
export const setLatency = (registry: AtomRegistry.AtomRegistry, ms: number) => {
	registry.set(IssuesClient.mutation("SetLatency"), {
		payload: { ms },
		reactivityKeys: [controlsKey],
	});
};

/**
 * Makes the demo server fail its next `count` requests with what `make`
 * returns, after the failures already queued.
 */
export const failNext = (
	registry: AtomRegistry.AtomRegistry,
	count: number,
	make: () => InjectedError,
) => {
	registry.set(IssuesClient.mutation("FailNext"), {
		payload: { count, error: make() },
		reactivityKeys: [controlsKey],
	});
};
