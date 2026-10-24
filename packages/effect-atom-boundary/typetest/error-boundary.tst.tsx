import { Effect, hole, Layer, Schema } from "effect";
import { HttpClient } from "effect/http";
import {
	HttpApi,
	HttpApiEndpoint,
	HttpApiGroup,
	HttpApiMiddleware,
} from "effect/http-api";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import * as AtomHttpApi from "effect/reactivity/AtomHttpApi";
import { describe, expect, it } from "tstyche";

import {
	AtomErrorBoundary,
	createErrorBoundary,
	type ErrorsOf,
	type UseErrorBoundary,
} from "../src/index.ts";
import { issue, Issues, user } from "../test/fixtures/issues.ts";

// The UI side imports the client and its atoms, never an error class: every
// error type below comes from the atoms.
type IssueError = Atom.Failure<ReturnType<typeof issue>>;
type UserError = Atom.Failure<ReturnType<typeof user>>;
type Issue = Atom.Success<ReturnType<typeof issue>>;
type Tagged<E, Tag extends string> = Extract<E, { readonly _tag: Tag }>;

class IssueGone extends Schema.TaggedError<IssueGone>()("IssueGone", {
	id: Schema.Int,
}) {}

class Forbidden extends Schema.TaggedError<Forbidden>()("Forbidden", {}) {}

class MissingSession extends Schema.TaggedError<MissingSession>()(
	"MissingSession",
	{},
) {}

class Session extends HttpApiMiddleware.Service<
	Session,
	{ clientError: MissingSession }
>()("Session", { error: Forbidden, requiredForClient: true }) {}

class Dashboard extends AtomHttpApi.Service<Dashboard>()("Dashboard", {
	api: HttpApi.make("Dashboard").add(
		HttpApiGroup.make("issues").add(
			HttpApiEndpoint.get("get", "/issue", {
				error: IssueGone,
				success: Schema.String,
			}),
		),
		HttpApiGroup.make("status").add(
			HttpApiEndpoint.get("get", "/status", {
				success: Schema.String,
			}).middleware(Session),
		),
	),
	httpClient: Layer.succeed(
		HttpClient.HttpClient,
		HttpClient.make(() => Effect.die("not used")),
	),
}) {}

const dashboardIssue = () => Dashboard.query("issues", "get", {});
const dashboardStatus = () => Dashboard.query("status", "get", {});

describe("ErrorsOf", () => {
	it("is the union of every procedure's errors for an AtomRpc client", () => {
		expect<ErrorsOf<typeof Issues>>().type.toBe<IssueError | UserError>();
	});

	it("is the union of every endpoint's and middleware's errors for an AtomHttpApi client", () => {
		expect<ErrorsOf<typeof Dashboard>>().type.toBe<
			IssueGone | MissingSession | Forbidden
		>();
		expect<ErrorsOf<typeof Dashboard>>().type.toBe<
			| Atom.Failure<ReturnType<typeof dashboardIssue>>
			| Atom.Failure<ReturnType<typeof dashboardStatus>>
		>();
	});

	it("types a shared boundary's handlers by an AtomHttpApi client's errors", () => {
		createErrorBoundary({
			catchTags: {
				Forbidden: (caught) => {
					expect(caught.error).type.toBe<Forbidden>();
					return null;
				},
				// @ts-expect-error Object literal may only specify known properties
				HttpClientError: () => null,
			},
			errors: Dashboard,
			name: "Dashboard",
		});
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
		expect(useOfflineBoundary).type.toBe<UseErrorBoundary<"Offline">>();
		expect(useAuthBoundary).type.toBe<
			UseErrorBoundary<"Offline" | "Unauthorized">
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

	type Left = Tagged<IssueError, "IssueNotFound" | "RpcClientError">;

	it("narrows a read's result to the errors it doesn't claim", () => {
		expect(
			useAuthBoundary(
				hole<
					| AsyncResult.Success<Issue, IssueError>
					| AsyncResult.Failure<Issue, IssueError>
				>(),
			),
		).type.toBe<
			AsyncResult.Success<Issue, Left> | AsyncResult.Failure<Issue, Left>
		>();
		expect(
			useAuthBoundary(hole<AsyncResult.AsyncResult<Issue, IssueError>>()),
		).type.toBe<AsyncResult.AsyncResult<Issue, Left>>();
		expect(
			useAuthBoundary(hole<AsyncResult.AsyncResult<string, UserError>>()),
		).type.toBe<AsyncResult.AsyncResult<string, UserError>>();
	});

	it("types a read whose failures it all claims as a success", () => {
		const [, useIssueBoundary] = createErrorBoundary({
			catchTags: { IssueNotFound: () => null, RpcClientError: () => null },
			errors: Issues,
			name: "Issue",
			parent: AuthBoundary,
		});
		expect(
			useIssueBoundary(
				hole<
					| AsyncResult.Success<Issue, IssueError>
					| AsyncResult.Failure<Issue, IssueError>
				>(),
			),
		).type.toBe<AsyncResult.Success<Issue, never>>();
	});

	it("rejects what isn't an AsyncResult, such as an atom", () => {
		expect(useAuthBoundary).type.not.toBeCallableWith(hole<number>());
		expect(useAuthBoundary).type.not.toBeCallableWith(
			hole<Atom.Atom<AsyncResult.AsyncResult<Issue, IssueError>>>(),
		);
	});
});
