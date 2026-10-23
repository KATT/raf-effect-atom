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
	issue,
	IssueNotFound,
	remadeIssue,
	serve,
	unkeyedIssue,
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
