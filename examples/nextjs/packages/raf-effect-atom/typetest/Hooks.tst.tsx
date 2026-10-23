import { type Effect, hole } from "effect";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { describe, expect, it } from "tstyche";

import {
	type Handle,
	Hydration,
	HydrationBoundary,
	type LoadedHandle,
	Loader,
	useAtomResult,
} from "../src/index.ts";
import { counter, issue, titled } from "../test/fixtures/issues.ts";

type IssueError = Atom.Failure<ReturnType<typeof issue>>;
type Issue = Atom.Success<ReturnType<typeof issue>>;

const prefetchTitled = (id: number) => Loader.prefetch(titled, id);

describe("useAtomResult", () => {
	it("reads a handle through its source, typed failures included", () => {
		expect(useAtomResult(issue, hole<Handle<typeof issue>>())).type.toBe<
			Loader.SettledResult<Issue, IssueError>
		>();
		expect(useAtomResult(issue, hole<LoadedHandle<typeof issue>>())).type.toBe<
			Loader.SettledResult<Issue, IssueError>
		>();
		expect(useAtomResult(counter, hole<Handle<typeof counter>>())).type.toBe<
			AsyncResult.Success<number, never>
		>();
	});

	it("reads a handle through a source derived from its own", () => {
		const claimed =
			hole<(id: number) => Atom.Atom<AsyncResult.AsyncResult<Issue, never>>>();
		expect(useAtomResult(claimed, hole<Handle<typeof issue>>())).type.toBe<
			AsyncResult.Success<Issue, never>
		>();
	});

	it("reads a derived atom's handle through it or a wrapper of it", () => {
		const handle = hole<Effect.Success<ReturnType<typeof prefetchTitled>>>();
		expect(handle).type.toBe<Handle<typeof titled>>();
		expect(useAtomResult).type.toBeCallableWith(titled, handle);
		const claimed =
			hole<(id: number) => Atom.Atom<AsyncResult.AsyncResult<Issue, never>>>();
		expect(useAtomResult(claimed, handle)).type.toBe<
			AsyncResult.Success<Issue, never>
		>();
	});

	it("rejects a handle of a source with other arguments or results", () => {
		const titles =
			hole<(id: number) => Atom.Atom<AsyncResult.AsyncResult<string, never>>>();
		const byName =
			hole<
				(name: string) => Atom.Atom<AsyncResult.AsyncResult<Issue, never>>
			>();
		expect(useAtomResult).type.not.toBeCallableWith(
			titles,
			hole<Handle<typeof issue>>(),
		);
		expect(useAtomResult).type.not.toBeCallableWith(
			byName,
			hole<Handle<typeof issue>>(),
		);
		expect(useAtomResult).type.not.toBeCallableWith(
			issue,
			hole<Handle<typeof counter>>(),
		);
	});

	it("rejects an atom that isn't an AsyncResult", () => {
		const plain = Atom.make(1);
		expect(useAtomResult).type.not.toBeCallableWith(
			plain,
			hole<Handle<typeof plain>>(),
		);
	});
});

describe("HydrationBoundary", () => {
	it("takes the state dehydrate returns", () => {
		const state = Hydration.dehydrate(hole<AtomRegistry.AtomRegistry>());
		expect(HydrationBoundary).type.toBeCallableWith({ state });
		expect(HydrationBoundary).type.not.toBeCallableWith({ state: [1] });
	});
});
