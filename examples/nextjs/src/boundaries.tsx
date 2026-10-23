"use client";

import { CaughtError } from "@examples/kit/components/issue-page";
import { createErrorBoundary } from "effect-atom-boundary";

import { IssuesClient } from "./issues.ts";
import { writeSession } from "./settings.ts";

/**
 * Around every page: signed out, every procedure fails with `Unauthorized`,
 * and this boundary renders instead of the page.
 */
export const [AuthBoundary, useAuthBoundary] = createErrorBoundary({
	catchTags: {
		Unauthorized: () => (
			<CaughtError
				action={{
					label: "Sign in",
					onClick: () => {
						writeSession("signed-in");
						// Every atom on the page failed; load them all again.
						window.location.reload();
					},
				}}
				boundary="AuthBoundary"
				tag="Unauthorized"
			>
				{"You're signed out, so the server refuses every request."}
			</CaughtError>
		),
	},
	errors: IssuesClient,
	name: "Auth",
});

/** Around an issue's page: the issue doesn't exist. */
export const [IssueBoundary, useIssueBoundary] = createErrorBoundary({
	catchTags: {
		IssueNotFound: (props) => (
			<CaughtError boundary="IssueBoundary" tag="IssueNotFound">
				{`Issue #${props.error.id} doesn't exist.`}
			</CaughtError>
		),
	},
	errors: IssuesClient,
	name: "Issue",
	parent: AuthBoundary,
});
