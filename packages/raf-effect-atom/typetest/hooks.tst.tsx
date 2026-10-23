import { hole } from "effect";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import {
	type ClaimedResult,
	createErrorBoundary,
	type ErrorBoundaryClaims,
} from "effect-atom-boundary";
import { describe, expect, it } from "tstyche";

import {
	Hydration,
	HydrationBoundary,
	type Loader,
	useAtomResult,
} from "../src/index.ts";
import { issue, Issues } from "../test/fixtures/issues.ts";

type IssueError = Atom.Failure<ReturnType<typeof issue>>;
type Issue = Atom.Success<ReturnType<typeof issue>>;

const [, useAuthBoundary] = createErrorBoundary({
	catchTags: { Unauthorized: () => null },
	errors: Issues,
	name: "Auth",
});

describe("useAtomResult", () => {
	it("returns the settled result without claims", () => {
		expect(useAtomResult(issue(1))).type.toBe<
			Loader.SettledResult<Issue, IssueError>
		>();
	});

	it("narrows the result to the errors its claims don't own", () => {
		const result = useAtomResult(issue(1), useAuthBoundary());
		expect(result).type.toBe<
			ClaimedResult<Issue, IssueError, "Unauthorized">
		>();
		expect<
			AsyncResult.Failure<
				Issue,
				Exclude<IssueError, { readonly _tag: "Unauthorized" }>
			>
		>().type.toBeAssignableTo<typeof result>();
	});

	it("takes the claims of any boundary", () => {
		expect(useAtomResult).type.toBeCallableWith(
			issue(1),
			hole<ErrorBoundaryClaims<"IssueNotFound" | "Unauthorized">>(),
		);
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
