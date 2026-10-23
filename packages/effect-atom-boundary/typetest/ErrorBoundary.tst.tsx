import { hole } from "effect";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { describe, expect, it } from "tstyche";

import {
	AtomErrorBoundary,
	claim,
	type ClaimedResult,
	createErrorBoundary,
	type ErrorBoundaryClaims,
	type ErrorsOf,
	useAtomResult,
} from "../src/index.ts";
import { issue, Issues, user } from "../test/fixtures/Issues.ts";

// The UI side imports the client and its atoms, never an error class: every
// error type below comes from the atoms.
type IssueError = Atom.Failure<ReturnType<typeof issue>>;
type UserError = Atom.Failure<ReturnType<typeof user>>;
type Issue = Atom.Success<ReturnType<typeof issue>>;
type Tagged<E, Tag extends string> = Extract<E, { readonly _tag: Tag }>;

describe("ErrorsOf", () => {
	it("is the union of every procedure's errors for an AtomRpc client", () => {
		expect<ErrorsOf<typeof Issues>>().type.toBe<IssueError | UserError>();
	});

	it("is the atom's error for an atom or an atom family", () => {
		expect<ErrorsOf<ReturnType<typeof issue>>>().type.toBe<IssueError>();
		expect<ErrorsOf<typeof issue>>().type.toBe<IssueError>();
	});
});

describe("AtomErrorBoundary", () => {
	it("types each handler's error by its tag", () => {
		<AtomErrorBoundary
			atom={issue(1)}
			catchTags={{
				IssueNotFound: (caught) => {
					expect(caught.error).type.toBe<Tagged<IssueError, "IssueNotFound">>();
					expect(caught.error.id).type.toBe<number>();
					expect(caught.reset).type.toBe<() => void>();
					return null;
				},
				RpcClientError: (caught) => {
					expect(caught.error).type.toBe<
						Tagged<IssueError, "RpcClientError">
					>();
					return null;
				},
			}}
		/>;
	});

	it("rejects a misspelled tag", () => {
		<AtomErrorBoundary
			atom={issue(1)}
			catchTags={{
				// @ts-expect-error Object literal may only specify known properties
				IssueNotFond: () => null,
			}}
		/>;
	});

	it("rejects a tag the atom can't fail with", () => {
		<AtomErrorBoundary
			atom={issue(1)}
			catchTags={{
				// @ts-expect-error Object literal may only specify known properties
				UserNotFound: () => null,
			}}
		/>;
	});

	it("rejects a field the caught error doesn't have", () => {
		<AtomErrorBoundary
			atom={issue(1)}
			catchTags={{
				IssueNotFound: (caught) => {
					// @ts-expect-error Property 'title' does not exist
					return caught.error.title;
				},
			}}
		/>;
	});
});

const [OfflineBoundary, useOfflineBoundary] = createErrorBoundary({
	catchTags: { Offline: () => null },
	errors: Issues,
	name: "Offline",
});

describe("createErrorBoundary", () => {
	it("types each handler's error by its tag", () => {
		createErrorBoundary({
			catchTags: {
				Unauthorized: (caught) => {
					expect(caught.error).type.toBe<Tagged<IssueError, "Unauthorized">>();
					expect(caught.error.reason).type.toBe<string>();
					return null;
				},
			},
			errors: Issues,
			name: "Auth",
		});
	});

	const [AuthBoundary, useAuthBoundary] = createErrorBoundary({
		catchTags: { Unauthorized: () => null },
		errors: Issues,
		name: "Auth",
		parent: OfflineBoundary,
	});

	it("claims the tags of its handlers, and its parent's", () => {
		expect(useOfflineBoundary).type.toBe<
			() => ErrorBoundaryClaims<"Offline">
		>();
		expect(useAuthBoundary).type.toBe<
			() => ErrorBoundaryClaims<"Offline" | "Unauthorized">
		>();
		expect(AuthBoundary).type.toBeCallableWith({ children: null });
	});

	it("rejects a misspelled tag", () => {
		createErrorBoundary({
			catchTags: {
				// @ts-expect-error Object literal may only specify known properties
				Unauthorised: () => null,
			},
			errors: Issues,
			name: "Auth",
		});
	});

	it("rejects a tag its errors can't fail with", () => {
		createErrorBoundary({
			catchTags: {
				// @ts-expect-error Object literal may only specify known properties
				UserNotFound: () => null,
			},
			errors: issue,
			name: "Issue",
		});
	});

	it("narrows a read under it to the unclaimed errors", () => {
		const result = useAtomResult(issue(1), useAuthBoundary());
		expect(result).type.toBe<
			| AsyncResult.Failure<
					Issue,
					Tagged<IssueError, "IssueNotFound" | "RpcClientError">
			  >
			| AsyncResult.Success<
					Issue,
					Tagged<IssueError, "IssueNotFound" | "RpcClientError">
			  >
		>();
	});
});

describe("useAtomResult", () => {
	it("returns a success without claims", () => {
		expect(useAtomResult(issue(1))).type.toBe<
			AsyncResult.Success<Issue, IssueError>
		>();
	});
});

describe("claim", () => {
	const registry = hole<AtomRegistry.AtomRegistry>();
	const result = hole<
		| AsyncResult.Failure<Issue, IssueError>
		| AsyncResult.Success<Issue, IssueError>
	>();

	it("returns a success without claims", () => {
		expect(claim(issue(1), registry, result)).type.toBe<
			AsyncResult.Success<Issue, IssueError>
		>();
	});

	it("narrows by the claims' tags", () => {
		const claims = hole<ErrorBoundaryClaims<"Offline" | "Unauthorized">>();
		expect(claim(issue(1), registry, result, claims)).type.toBe<
			ClaimedResult<Issue, IssueError, "Offline" | "Unauthorized">
		>();
		expect(claims.claim(issue(1), registry, result)).type.toBe<
			ClaimedResult<Issue, IssueError, "Offline" | "Unauthorized">
		>();
	});

	it("rejects a result of another atom", () => {
		expect(claim).type.not.toBeCallableWith(user("a"), registry, result);
	});
});
