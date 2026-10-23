import { assert, describe, it } from "@effect/vitest";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as EffectHydration from "effect/reactivity/Hydration";

import { Hydration, Loader, RequestRegistry } from "../src/index.ts";
import {
	counter,
	issue,
	IssueNotFound,
	serve,
	unkeyedIssue,
} from "./fixtures/Issues.ts";
import { wire } from "./fixtures/wire.ts";

const errorOf = (result: AsyncResult.AsyncResult<unknown, unknown>) =>
	AsyncResult.isFailure(result)
		? Option.getOrUndefined(Cause.findErrorOption(result.cause))
		: undefined;

/**
 * Runs `load` on a request registry and dehydrates it. The registry lives
 * until the result is disposed, as it does until a response finishes.
 */
const render = (
	load: Effect.Effect<void, never, AtomRegistry.AtomRegistry>,
) => {
	const registry = RequestRegistry.make();
	return Effect.gen(function* () {
		yield* load;
		return {
			state: wire(Hydration.dehydrate(registry)),
			[Symbol.dispose]: () => registry.dispose(),
		};
	}).pipe(Effect.provideService(AtomRegistry.AtomRegistry, registry));
};

describe("hydrated", () => {
	it("returns the same copy for an atom, under its key", () => {
		const copy = Hydration.hydrated(issue(1));
		assert.strictEqual(Hydration.hydrated(issue(1)), copy);
		assert.strictEqual(Hydration.hydrated(copy), copy);
		assert.notStrictEqual(copy, issue(1));
		assert.isTrue(Atom.isSerializable(copy));
		assert.strictEqual(
			Atom.isSerializable(copy) && copy[Atom.SerializableTypeId].key,
			"AtomRpc:GetIssue:1",
		);
	});

	it("returns an atom that isn't serializable as it is", () => {
		assert.strictEqual(Hydration.hydrated(counter), counter);
		assert.strictEqual(Hydration.hydrated(unkeyedIssue(1)), unkeyedIssue(1));
	});
});

describe("dehydrate and hydrate", () => {
	it.live("keep a server-side IssueNotFound an IssueNotFound", () =>
		Effect.gen(function* () {
			using server = serve({ 1: ["missing"] });
			using rendered = yield* render(Effect.asVoid(Loader.ensure(issue(1))));
			const browser = AtomRegistry.make();
			Hydration.hydrate(browser, rendered.state);
			const error = errorOf(browser.get(Hydration.hydrated(issue(1))));
			assert.instanceOf(error, IssueNotFound);
			assert.strictEqual(error.id, 1);
			assert.strictEqual(server.requests(1), 1);
			browser.dispose();
		}),
	);

	it.live("keep a hydrated success without requesting it again", () =>
		Effect.gen(function* () {
			using server = serve();
			using rendered = yield* render(Effect.asVoid(Loader.ensure(issue(1))));
			const browser = AtomRegistry.make();
			Hydration.hydrate(browser, rendered.state);
			const result = browser.get(Hydration.hydrated(issue(1)));
			assert.deepStrictEqual(AsyncResult.getOrThrow(result), {
				id: 1,
				title: "Issue 1",
			});
			yield* Effect.sleep("20 millis");
			assert.strictEqual(server.requests(1), 1);
			browser.dispose();
		}),
	);

	it.live("request it again when read without hydrated, as Atom does", () =>
		Effect.gen(function* () {
			using server = serve();
			using rendered = yield* render(Effect.asVoid(Loader.ensure(issue(1))));
			const browser = AtomRegistry.make();
			EffectHydration.hydrate(browser, rendered.state);
			browser.get(issue(1));
			assert.strictEqual(server.requests(1), 2);
			browser.dispose();
		}),
	);

	it.live("hold a streamed result until it arrives, then hydrate it", () =>
		Effect.gen(function* () {
			using server = serve();
			using rendered = yield* render(Loader.prefetch(issue(2)));
			const entry = EffectHydration.toValues(rendered.state)[0];
			assert.isDefined(entry?.resultPromise);
			const browser = AtomRegistry.make();
			Hydration.hydrate(browser, rendered.state);
			assert.isFalse(browser.getNodes().has("AtomRpc:GetIssue:2"));
			assert.isFalse(browser.preloadedSerializable.has("AtomRpc:GetIssue:2"));
			yield* Effect.promise(() => entry!.resultPromise!);
			yield* Effect.yieldNow;
			const result = browser.get(Hydration.hydrated(issue(2)));
			assert.isTrue(AsyncResult.isSuccess(result));
			assert.strictEqual(server.requests(2), 1);
			browser.dispose();
		}),
	);

	it.live("drop a streamed result whose promise rejects", () =>
		Effect.gen(function* () {
			using server = serve();
			const browser = AtomRegistry.make();
			const failed: EffectHydration.DehydratedAtomValue = {
				"~effect/reactivity/Hydration/DehydratedAtom": true,
				dehydratedAt: 0,
				key: "AtomRpc:GetIssue:3",
				resultPromise: Promise.reject(new Error("the stream closed")),
				value: null,
			};
			Hydration.hydrate(browser, [failed]);
			yield* Effect.yieldNow;
			yield* Effect.yieldNow;
			browser.get(Hydration.hydrated(issue(3)));
			assert.strictEqual(server.requests(3), 1);
			browser.dispose();
		}),
	);
});
