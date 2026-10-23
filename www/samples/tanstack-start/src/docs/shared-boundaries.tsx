import type { IssueId } from "@examples/contract";
import { createErrorBoundary } from "effect-atom-boundary";
import { useAtomResult } from "raf-effect-atom";

import { AuthBoundary, useAuthBoundary } from "~/boundaries.tsx";
import { IssuesClient } from "~/issues-client.ts";
import { issue } from "~/issues.ts";

declare const id: IssueId;

// #region narrowed
function IssueTitle(props: { id: IssueId }) {
	const result = useAtomResult(useAuthBoundary().wrap(issue(props.id)));
	result;
	// ^?
	return null;
}
// #endregion narrowed

// #region misspelled
createErrorBoundary({
	name: "Auth",
	errors: IssuesClient,
	catchTags: {
		// @ts-expect-error -- 2561: no procedure fails with Unauthorised
		Unauthorised: () => <p>Sign in</p>,
	},
});
// #endregion misspelled

// #region app
function App() {
	return (
		<AuthBoundary>
			<IssueTitle id={id} />
		</AuthBoundary>
	);
}
// #endregion app
