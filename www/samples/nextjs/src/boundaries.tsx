// #region issue
"use client";
// #endregion

import { createErrorBoundary } from "effect-atom-boundary";

import { IssuesClient } from "./issues-client.ts";

// #region app
// Every procedure fails with RpcClientError when the request doesn't reach
// the server, so the app catches it once.
export const [AppBoundary] = createErrorBoundary({
	name: "App",
	errors: IssuesClient,
	catchTags: {
		RpcClientError: ({ reset }) => (
			<p>
				Can't reach the server. <button onClick={reset}>Try again</button>
			</p>
		),
	},
});
// #endregion app

// #region auth
// Under the App boundary: every procedure can fail with Unauthorized too.
export const [AuthBoundary] = createErrorBoundary({
	name: "Auth",
	errors: IssuesClient,
	parent: AppBoundary,
	catchTags: {
		Unauthorized: ({ reset }) => (
			<p>
				You're signed out. <button onClick={reset}>Try again</button>
			</p>
		),
	},
});
// #endregion auth

// #region issue
// Under the Auth boundary: it claims IssueNotFound, and Unauthorized and
// RpcClientError still go up the chain.
export const [IssueBoundary, useIssueBoundary] = createErrorBoundary({
	name: "Issue",
	errors: IssuesClient,
	parent: AuthBoundary,
	catchTags: {
		IssueNotFound: ({ error }) => <p>There's no issue #{error.id}.</p>,
	},
});
// #endregion issue
