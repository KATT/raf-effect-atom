import { hole } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { describe, expect, it } from "tstyche";

import {
	Hydration,
	HydrationBoundary,
	type Loader,
	useAtomResult,
} from "../src/index.ts";
import { issue } from "../test/fixtures/issues.ts";

type IssueError = Atom.Failure<ReturnType<typeof issue>>;
type Issue = Atom.Success<ReturnType<typeof issue>>;

describe("useAtomResult", () => {
	it("returns the settled result, typed failures included", () => {
		expect(useAtomResult(issue(1))).type.toBe<
			Loader.SettledResult<Issue, IssueError>
		>();
	});

	it("reads an atom derived with an initialValueTarget", () => {
		const titled = Atom.transform(
			issue(1),
			(get) =>
				AsyncResult.map(get(issue(1)), (found) => ({
					...found,
					title: `Titled ${found.title}`,
				})),
			{ initialValueTarget: issue(1) },
		);
		expect(useAtomResult(titled)).type.toBe<
			Loader.SettledResult<Issue, IssueError>
		>();
	});

	it("rejects an atom that isn't an AsyncResult", () => {
		expect(useAtomResult).type.not.toBeCallableWith(Atom.make(1));
	});
});

describe("HydrationBoundary", () => {
	it("takes the state dehydrate returns", () => {
		const state = Hydration.dehydrate(hole<AtomRegistry.AtomRegistry>());
		expect(HydrationBoundary).type.toBeCallableWith({ state });
		expect(HydrationBoundary).type.not.toBeCallableWith({ state: [1] });
	});
});
