import { CaughtError } from "@examples/kit/components/issue-page";
import { createErrorBoundary } from "effect-atom-boundary";

import { IssuesClient } from "./issues.ts";
import { writeSession } from "./settings.ts";

/**
 * Around the app: the request didn't reach the server, or its answer didn't
 * decode. Effect RPC fails every procedure with `RpcClientError` then, so
 * the app catches it once, and `Try again` loads the atom that failed again.
 */
export const [AppBoundary] = createErrorBoundary({
	catchTags: {
		RpcClientError: (props) => (
			<CaughtError
				action={{ label: "Try again", onClick: props.reset }}
				boundary="AppBoundary"
				tag="RpcClientError"
			>
				{"Can't reach the server, so this page didn't load."}
			</CaughtError>
		),
	},
	errors: IssuesClient,
	name: "App",
});

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
	parent: AppBoundary,
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
