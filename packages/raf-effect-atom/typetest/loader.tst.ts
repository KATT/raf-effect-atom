import { hole } from "effect";
import type * as Effect from "effect/Effect";
import * as Atom from "effect/reactivity/Atom";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { describe, expect, it } from "tstyche";

import { Hydration, Loader } from "../src/index.ts";
import { issue } from "../test/fixtures/issues.ts";

type IssueError = Atom.Failure<ReturnType<typeof issue>>;
type Issue = Atom.Success<ReturnType<typeof issue>>;

describe("Loader", () => {
	it("returns the settled result, typed by the atom", () => {
		expect(Loader.prefetch(issue(1))).type.toBe<
			Effect.Effect<void, never, AtomRegistry.AtomRegistry>
		>();
		expect(Loader.ensure(issue(1))).type.toBe<
			Effect.Effect<
				Loader.SettledResult<Issue, IssueError>,
				never,
				AtomRegistry.AtomRegistry
			>
		>();
		expect(Loader.fetch(issue(1))).type.toBe<
			Effect.Effect<
				Loader.SettledResult<Issue, IssueError>,
				never,
				AtomRegistry.AtomRegistry
			>
		>();
	});

	it("returns Promises from make", () => {
		const loader = Loader.make(hole<AtomRegistry.AtomRegistry>());
		expect(loader.prefetch(issue(1))).type.toBe<void>();
		expect(loader.ensure(issue(1))).type.toBe<
			Promise<Loader.SettledResult<Issue, IssueError>>
		>();
		expect(loader.fetch(issue(1))).type.toBe<
			Promise<Loader.SettledResult<Issue, IssueError>>
		>();
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
