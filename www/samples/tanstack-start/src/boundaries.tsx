import { createErrorBoundary } from "effect-atom-boundary";

import { IssuesClient } from "./issues-client.ts";

// #region auth
// Every procedure can fail with Unauthorized, so the app catches it once.
export const [AuthBoundary, useAuthBoundary] = createErrorBoundary({
	name: "Auth",
	errors: IssuesClient,
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
// Under the Auth boundary: it claims IssueNotFound, and Unauthorized still
// goes up to Auth.
export const [IssueBoundary, useIssueBoundary] = createErrorBoundary({
	name: "Issue",
	errors: IssuesClient,
	parent: AuthBoundary,
	catchTags: {
		IssueNotFound: ({ error }) => <p>There's no issue #{error.id}.</p>,
	},
});
// #endregion issue
