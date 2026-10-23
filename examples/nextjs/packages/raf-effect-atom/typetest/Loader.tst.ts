import { hole } from "effect";
import type * as Effect from "effect/Effect";
import * as Atom from "effect/reactivity/Atom";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { describe, expect, it } from "tstyche";

import {
	type Handle,
	Hydration,
	type LoadedHandle,
	Loader,
} from "../src/index.ts";
import { counter, issue } from "../test/fixtures/issues.ts";

type IssueError = Atom.Failure<ReturnType<typeof issue>>;
type Issue = Atom.Success<ReturnType<typeof issue>>;

describe("Loader", () => {
	it("returns a handle typed by its source", () => {
		expect(Loader.prefetch(issue, 1)).type.toBe<
			Effect.Effect<Handle<typeof issue>, never, AtomRegistry.AtomRegistry>
		>();
		expect(Loader.ensure(issue, 1)).type.toBe<
			Effect.Effect<
				LoadedHandle<typeof issue>,
				never,
				AtomRegistry.AtomRegistry
			>
		>();
		expect(Loader.fetch(issue, 1)).type.toBe<
			Effect.Effect<
				LoadedHandle<typeof issue>,
				never,
				AtomRegistry.AtomRegistry
			>
		>();
	});

	it("records the source's arguments, or none for an atom", () => {
		expect(hole<Handle<typeof issue>>().args).type.toBe<[id: number]>();
		expect(Loader.prefetch(counter)).type.toBe<
			Effect.Effect<Handle<typeof counter>, never, AtomRegistry.AtomRegistry>
		>();
		expect(hole<Handle<typeof counter>>().args).type.toBe<[]>();
	});

	it("checks the arguments against the source", () => {
		expect(Loader.prefetch).type.not.toBeCallableWith(issue, "1");
		expect(Loader.prefetch).type.not.toBeCallableWith(issue);
		expect(Loader.prefetch).type.not.toBeCallableWith(counter, 1);
	});

	it("returns the result a verb waited for", () => {
		expect(Loader.result(hole<LoadedHandle<typeof issue>>())).type.toBe<
			Loader.SettledResult<Issue, IssueError>
		>();
		expect(Loader.result).type.not.toBeCallableWith(
			hole<Handle<typeof issue>>(),
		);
	});

	it("fits a loaded handle where a handle goes, not the reverse", () => {
		expect(hole<LoadedHandle<typeof issue>>()).type.toBeAssignableTo<
			Handle<typeof issue>
		>();
		expect(hole<Handle<typeof issue>>()).type.not.toBeAssignableTo<
			LoadedHandle<typeof issue>
		>();
	});

	it("returns Promises from make", () => {
		const loader = Loader.make(hole<AtomRegistry.AtomRegistry>());
		expect(loader.prefetch(issue, 1)).type.toBe<Handle<typeof issue>>();
		expect(loader.ensure(issue, 1)).type.toBe<
			Promise<LoadedHandle<typeof issue>>
		>();
		expect(loader.fetch(issue, 1)).type.toBe<
			Promise<LoadedHandle<typeof issue>>
		>();
	});

	it("runs an Effect that needs only the registry, with its success type", () => {
		const loader = Loader.make(hole<AtomRegistry.AtomRegistry>());
		expect(loader.run(Loader.ensure(issue, 1))).type.toBe<
			Promise<LoadedHandle<typeof issue>>
		>();
		expect(
			loader.run(hole<Effect.Effect<number, "boom">>(), {
				signal: hole<AbortSignal>(),
			}),
		).type.toBe<Promise<number>>();
		expect(loader.run).type.not.toBeCallableWith(
			hole<Effect.Effect<number, never, "OtherService">>(),
		);
	});

	it("rejects an atom that isn't an AsyncResult", () => {
		expect(Loader.ensure).type.not.toBeCallableWith(Atom.make(1));
		expect(
			Loader.make(hole<AtomRegistry.AtomRegistry>()).prefetch,
		).type.not.toBeCallableWith(Atom.make(1));
	});
});

describe("hydrated", () => {
	it("keeps the atom's type", () => {
		expect(Hydration.hydrated(issue(1))).type.toBe<ReturnType<typeof issue>>();
	});
});
