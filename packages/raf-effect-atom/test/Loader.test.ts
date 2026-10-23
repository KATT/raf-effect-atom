import { assert, describe, it } from "@effect/vitest";
import * as Cause from "effect/Cause";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";

import { Loader, RequestRegistry } from "../src/index.ts";
import {
	counter,
	gated,
	greeting,
	issue,
	IssueNotFound,
	remadeIssue,
	later,
	serve,
	unkeyedIssue,
	viewer,
} from "./fixtures/issues.ts";

/** A browser registry with a short idle TTL, disposed with the test. */
const browser = (defaultIdleTTL = 20) =>
	AtomRegistry.layerOptions({ defaultIdleTTL });

const errorOf = (result: Loader.SettledResult<unknown, unknown>) =>
	AsyncResult.isFailure(result)
		? Option.getOrUndefined(Cause.findErrorOption(result.cause))
		: undefined;

const nodeOf = (registry: AtomRegistry.AtomRegistry, id: number) =>
	registry.getNodes().get(`AtomRpc:GetIssue:${id}`);

describe("prefetch", () => {
	it.live("starts the atom without waiting for it", () =>
		Effect.gen(function* () {
			using server = serve();
			const registry = yield* AtomRegistry.AtomRegistry;
			yield* Loader.prefetch(issue, 1);
			assert.isTrue(AsyncResult.isInitial(registry.get(issue(1))));
			assert.strictEqual(server.requests(1), 1);
		}).pipe(Effect.provide(browser())),
	);

	it.live("leaves an atom it already started alone", () =>
		Effect.gen(function* () {
			using server = serve();
			yield* Loader.prefetch(issue, 1);
			yield* Loader.prefetch(issue, 1);
			yield* Loader.ensure(issue, 1);
			assert.strictEqual(server.requests(1), 1);
		}).pipe(Effect.provide(browser())),
	);

	it.live("keeps the atom past the idle TTL, until its lease ends", () =>
		Effect.gen(function* () {
			using server = serve();
			const registry = yield* AtomRegistry.AtomRegistry;
			yield* Loader.prefetch(issue, 1).pipe(
				Effect.provideService(Loader.LeaseTTL, Duration.millis(100)),
			);
			yield* Effect.sleep("60 millis");
			assert.isDefined(nodeOf(registry, 1));
			yield* Effect.sleep("150 millis");
			assert.isUndefined(nodeOf(registry, 1));
			assert.strictEqual(server.requests(1), 1);
		}).pipe(Effect.provide(browser())),
	);
});

describe("ensure", () => {
	it.live("waits for the first result", () =>
		Effect.gen(function* () {
			using server = serve();
			const result = Loader.result(yield* Loader.ensure(issue, 1));
			assert.deepStrictEqual(AsyncResult.getOrThrow(result), {
				id: 1,
				title: "Issue 1",
			});
			assert.strictEqual(server.requests(1), 1);
		}).pipe(Effect.provide(browser())),
	);

	it.live("returns a result it has without refetching", () =>
		Effect.gen(function* () {
			using server = serve();
			const first = Loader.result(yield* Loader.ensure(issue, 1));
			const second = Loader.result(yield* Loader.ensure(issue, 1));
			assert.strictEqual(second, first);
			assert.strictEqual(server.requests(1), 1);
		}).pipe(Effect.provide(browser())),
	);

	it.live("returns a typed failure as the result", () =>
		Effect.gen(function* () {
			using _server = serve({ 1: ["missing"] });
			const result = Loader.result(yield* Loader.ensure(issue, 1));
			assert.instanceOf(errorOf(result), IssueNotFound);
		}).pipe(Effect.provide(browser())),
	);

	it.live("fails on a defect", () =>
		Effect.gen(function* () {
			using _server = serve({ 1: ["crash"] });
			const exit = yield* Effect.exit(Loader.ensure(issue, 1));
			assert.isTrue(Exit.hasDies(exit));
		}).pipe(Effect.provide(browser())),
	);

	it.live("returns a refreshing result at once in the browser", () =>
		Effect.gen(function* () {
			using server = serve();
			const registry = yield* AtomRegistry.AtomRegistry;
			yield* Loader.ensure(issue, 1);
			registry.refresh(issue(1));
			const result = Loader.result(yield* Loader.ensure(issue, 1));
			assert.isTrue(result.waiting);
			assert.strictEqual(server.requests(1), 2);
		}).pipe(Effect.provide(browser())),
	);

	it.live("waits out a refresh on a request registry", () =>
		Effect.gen(function* () {
			using server = serve();
			const registry = yield* AtomRegistry.AtomRegistry;
			yield* Loader.ensure(issue, 1);
			registry.refresh(issue(1));
			const result = Loader.result(yield* Loader.ensure(issue, 1));
			assert.isFalse(result.waiting);
			assert.strictEqual(server.requests(1), 2);
		}).pipe(Effect.provide(RequestRegistry.layer)),
	);

	it.live("works for any AsyncResult atom", () =>
		Effect.gen(function* () {
			const result = Loader.result(yield* Loader.ensure(counter));
			assert.strictEqual(AsyncResult.getOrThrow(result), 1);
		}).pipe(Effect.provide(browser())),
	);
});

describe("fetch", () => {
	it.live("requests an atom it hasn't started once", () =>
		Effect.gen(function* () {
			using server = serve();
			yield* Loader.fetch(issue, 1);
			assert.strictEqual(server.requests(1), 1);
		}).pipe(Effect.provide(browser())),
	);

	it.live("refreshes a settled atom and waits for the new result", () =>
		Effect.gen(function* () {
			using server = serve({ 1: ["missing", "found"] });
			const first = Loader.result(yield* Loader.ensure(issue, 1));
			const second = Loader.result(yield* Loader.fetch(issue, 1));
			assert.isTrue(AsyncResult.isFailure(first));
			assert.isTrue(AsyncResult.isSuccess(second));
			assert.isFalse(second.waiting);
			assert.strictEqual(server.requests(1), 2);
		}).pipe(Effect.provide(browser())),
	);

	it.live("refreshes the atom the registry runs for its key", () =>
		Effect.gen(function* () {
			using server = serve({ 1: ["missing", "found"] });
			yield* Loader.ensure(issue, 1);
			const result = Loader.result(yield* Loader.fetch(remadeIssue, 1));
			assert.isTrue(AsyncResult.isSuccess(result));
			assert.strictEqual(server.requests(1), 2);
		}).pipe(Effect.provide(browser())),
	);
});

describe("handles", () => {
	it.live("hold the source's arguments and the atom's key, as plain data", () =>
		Effect.gen(function* () {
			using _server = serve();
			const prefetched = yield* Loader.prefetch(issue, 1);
			const loaded = yield* Loader.ensure(issue, 2);
			const counted = yield* Loader.ensure(counter);
			assert.deepStrictEqual(prefetched, {
				args: [1],
				key: "AtomRpc:GetIssue:1",
			});
			// oxlint-disable-next-line unicorn/prefer-structured-clone -- the JSON round trip is the point: loader data crosses as JSON
			assert.deepStrictEqual(JSON.parse(JSON.stringify(loaded)), {
				args: [2],
				key: "AtomRpc:GetIssue:2",
				loaded: true,
			});
			assert.deepStrictEqual(counted, {
				args: [],
				key: undefined,
				loaded: true,
			});
		}).pipe(Effect.provide(browser())),
	);

	it.live("give their result only to the code that ran the verb", () =>
		Effect.gen(function* () {
			using _server = serve();
			const handle = yield* Loader.ensure(issue, 1);
			assert.isTrue(AsyncResult.isSuccess(Loader.result(handle)));
			assert.throws(
				() => Loader.result(structuredClone(handle)),
				/no ensure or fetch returned here/,
			);
		}).pipe(Effect.provide(browser())),
	);
});

describe("request registries", () => {
	it.live("refuse an atom that isn't serializable in development", () =>
		Effect.gen(function* () {
			using server = serve();
			const exit = yield* Effect.exit(Loader.prefetch(unkeyedIssue, 1));
			assert.isTrue(Exit.hasDies(exit));
			assert.include(
				String(Exit.isFailure(exit) && Cause.squash(exit.cause)),
				"isn't serializable",
			);
			assert.strictEqual(server.requests(1), 0);
		}).pipe(Effect.provide(RequestRegistry.layer)),
	);

	it.live("allow it in the browser", () =>
		Effect.gen(function* () {
			using server = serve();
			yield* Loader.ensure(unkeyedIssue, 1);
			assert.strictEqual(server.requests(1), 1);
		}).pipe(Effect.provide(browser())),
	);

	it.live("keep a loader's atom until the registry is disposed", () =>
		Effect.gen(function* () {
			using server = serve();
			const registry = yield* AtomRegistry.AtomRegistry;
			yield* Loader.prefetch(issue, 1);
			yield* Effect.sleep("100 millis");
			assert.isDefined(nodeOf(registry, 1));
			assert.strictEqual(server.requests(1), 1);
		}).pipe(Effect.provide(RequestRegistry.layer)),
	);

	it("are marked, and browser registries aren't", () => {
		assert.isTrue(RequestRegistry.isRequestRegistry(RequestRegistry.make()));
		assert.isFalse(RequestRegistry.isRequestRegistry(AtomRegistry.make()));
	});
});

describe("seeded request registries", () => {
	const seeded = () =>
		RequestRegistry.make({
			seed: async (registry) => {
				await later(10);
				registry.set(viewer, "ada");
			},
		});

	const rejection = (promise: Promise<unknown>) =>
		promise.then(() => assert.fail("it resolved"), String);

	const started = (registry: AtomRegistry.AtomRegistry) =>
		registry.getNodes().has("greeting");

	it("run a sync seed before any verb", async () => {
		const registry = RequestRegistry.make({
			seed: (fresh) => fresh.set(viewer, "ada"),
		});
		const handle = await Loader.make(registry).ensure(greeting);
		const result = Loader.result(handle);
		assert.isTrue(
			AsyncResult.isSuccess(result) && result.value === "Hello, ada",
		);
		registry.dispose();
	});

	it("make ensure and fetch wait for an async seed", async () => {
		const registry = seeded();
		const loader = Loader.make(registry);
		const ensured = Loader.result(await loader.ensure(greeting));
		assert.isTrue(
			AsyncResult.isSuccess(ensured) && ensured.value === "Hello, ada",
		);
		const fetched = Loader.result(await loader.fetch(greeting));
		assert.isTrue(
			AsyncResult.isSuccess(fetched) && fetched.value === "Hello, ada",
		);
		registry.dispose();
	});

	it("start a prefetch after the seed, and settled waits for it", async () => {
		const registry = seeded();
		Loader.make(registry).prefetch(greeting);
		assert.isFalse(started(registry));
		await RequestRegistry.settled(registry);
		assert.isTrue(started(registry));
		const result = Loader.result(await Loader.make(registry).ensure(greeting));
		assert.isTrue(
			AsyncResult.isSuccess(result) && result.value === "Hello, ada",
		);
		registry.dispose();
	});

	it("reject the verbs and settled once a seed fails", async () => {
		const registry = RequestRegistry.make({
			seed: () => Promise.reject(new Error("no cookie")),
		});
		const loader = Loader.make(registry);
		loader.prefetch(greeting);
		assert.include(await rejection(loader.ensure(greeting)), "no cookie");
		assert.include(
			await rejection(RequestRegistry.settled(registry)),
			"no cookie",
		);
		assert.include(await rejection(loader.fetch(greeting)), "no cookie");
		assert.isFalse(started(registry));
		registry.dispose();
	});
});

describe("make", () => {
	it.live("runs the verbs as Promises over one registry", () =>
		Effect.gen(function* () {
			using server = serve({ 2: ["missing"] });
			const registry = yield* AtomRegistry.AtomRegistry;
			const loader = Loader.make(registry);
			loader.prefetch(issue, 1);
			const found = yield* Effect.promise(() => loader.ensure(issue, 1));
			const missing = yield* Effect.promise(() => loader.fetch(issue, 2));
			assert.isTrue(AsyncResult.isSuccess(Loader.result(found)));
			assert.isTrue(AsyncResult.isFailure(Loader.result(missing)));
			assert.strictEqual(server.requests(1), 1);
		}).pipe(Effect.provide(browser())),
	);

	it.live("rejects only on a defect", () =>
		Effect.gen(function* () {
			using _server = serve({ 1: ["crash"] });
			const loader = Loader.make(yield* AtomRegistry.AtomRegistry);
			const exit = yield* Effect.exit(
				Effect.tryPromise(() => loader.ensure(issue, 1)),
			);
			assert.isTrue(Exit.isFailure(exit));
		}).pipe(Effect.provide(browser())),
	);

	it.live(
		"stops waiting when its signal aborts, with the signal's reason",
		() =>
			Effect.gen(function* () {
				const registry = yield* AtomRegistry.AtomRegistry;
				const gate = gated("make-signal");
				const controller = new AbortController();
				const loader = Loader.make(registry, { signal: controller.signal });
				const waiting = loader.ensure(gate.atom);
				const refreshing = loader.fetch(gate.atom);
				yield* Effect.sleep("5 millis");
				const reason = new Error("the navigation left");
				controller.abort(reason);
				const ensureRejection = yield* Effect.flip(
					Effect.tryPromise(() => waiting),
				);
				const fetchRejection = yield* Effect.flip(
					Effect.tryPromise(() => refreshing),
				);
				assert.strictEqual(ensureRejection.cause, reason);
				assert.strictEqual(fetchRejection.cause, reason);
				// The atom keeps loading, under the verbs' lease.
				assert.isTrue(AsyncResult.isInitial(registry.get(gate.atom)));
				gate.open("loaded");
				yield* Effect.sleep("5 millis");
				const result = registry.get(gate.atom);
				assert.isTrue(
					AsyncResult.isSuccess(result) && result.value === "loaded",
				);
			}).pipe(Effect.provide(browser())),
	);

	it.live("runs an Effect on its registry, rejecting with its failure", () =>
		Effect.gen(function* () {
			using server = serve();
			const registry = yield* AtomRegistry.AtomRegistry;
			const loader = Loader.make(registry);
			const handles = yield* Effect.promise(() =>
				loader.run(
					Effect.gen(function* () {
						const assignee = yield* Loader.prefetch(issue, 2);
						const loaded = yield* Loader.ensure(issue, 1);
						return { assignee, issue: loaded };
					}),
				),
			);
			assert.isTrue(AsyncResult.isSuccess(Loader.result(handles.issue)));
			assert.strictEqual(server.requests(2), 1);
			const rejection = yield* Effect.flip(
				Effect.tryPromise(() => loader.run(Effect.fail("boom"))),
			);
			assert.strictEqual(rejection.cause, "boom");
		}).pipe(Effect.provide(browser())),
	);

	it.live("interrupts run with its own signal or the loader's", () =>
		Effect.gen(function* () {
			const registry = yield* AtomRegistry.AtomRegistry;
			const gate = gated("run-signal");
			const made = new AbortController();
			const given = new AbortController();
			const loader = Loader.make(registry, { signal: made.signal });
			const byGiven = loader.run(Loader.ensure(gate.atom), {
				signal: given.signal,
			});
			const byMade = loader.run(Loader.ensure(gate.atom), {
				signal: new AbortController().signal,
			});
			yield* Effect.sleep("5 millis");
			const givenReason = new Error("the navigation left");
			given.abort(givenReason);
			const givenRejection = yield* Effect.flip(
				Effect.tryPromise(() => byGiven),
			);
			assert.strictEqual(givenRejection.cause, givenReason);
			const madeReason = new Error("the request left");
			made.abort(madeReason);
			const madeRejection = yield* Effect.flip(Effect.tryPromise(() => byMade));
			assert.strictEqual(madeRejection.cause, madeReason);
			gate.open("loaded");
		}).pipe(Effect.provide(browser())),
	);

	it.live("takes a lease TTL", () =>
		Effect.gen(function* () {
			using _server = serve();
			const registry = yield* AtomRegistry.AtomRegistry;
			Loader.make(registry, { leaseTTL: "20 millis" }).prefetch(issue, 1);
			yield* Effect.sleep("150 millis");
			assert.isUndefined(nodeOf(registry, 1));
		}).pipe(Effect.provide(browser())),
	);
});

describe("layer", () => {
	it.effect("disposes the request registry with its scope", () =>
		Effect.gen(function* () {
			const registry = yield* AtomRegistry.AtomRegistry.pipe(
				Effect.provide(RequestRegistry.layer),
			);
			assert.isTrue(RequestRegistry.isRequestRegistry(registry));
			assert.throws(() => registry.get(counter), /disposed/);
		}),
	);
});
