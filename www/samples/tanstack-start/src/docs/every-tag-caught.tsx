import type { IssueId } from "@examples/contract";
import { createErrorBoundary } from "effect-atom-boundary";
import { useAtomResult } from "raf-effect-atom";
import { Suspense } from "react";

import { issue } from "~/issues.ts";

// #region every-tag
export const [AppBoundary] = createErrorBoundary({
	name: "App",
	errors: issue,
	catchTags: {
		RpcClientError: ({ reset }) => (
			<p>
				Can't reach the server. <button onClick={reset}>Try again</button>
			</p>
		),
	},
});

export const [IssuePageBoundary, useIssuePageBoundary] = createErrorBoundary({
	name: "IssuePage",
	errors: issue,
	parent: AppBoundary,
	catchTags: {
		IssueNotFound: ({ error }) => <p>There's no issue #{error.id}.</p>,
		Unauthorized: ({ reset }) => (
			<p>
				You're signed out. <button onClick={reset}>Try again</button>
			</p>
		),
	},
});

export function IssuePage(props: { id: IssueId }) {
	return (
		<AppBoundary>
			<IssuePageBoundary>
				<Suspense fallback={<p>Loading…</p>}>
					<IssueTitle id={props.id} />
				</Suspense>
			</IssuePageBoundary>
		</AppBoundary>
	);
}

function IssueTitle(props: { id: IssueId }) {
	const result = useAtomResult(useIssuePageBoundary().wrap(issue(props.id)));
	//    ^?
	return <h1>{result.value.title}</h1>;
}
// #endregion every-tag
