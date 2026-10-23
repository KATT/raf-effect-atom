// #region component
"use client";
// #endregion

import type { IssueId } from "@examples/contract";
import { useAtomResult } from "raf-effect-atom";
import { Suspense } from "react";

import { useIssueBoundary } from "~/boundaries.tsx";
import { assignee, issue } from "~/issues.ts";

// #region component
export function IssuePage(props: { id: IssueId }) {
	// IssueNotFound, Unauthorized and RpcClientError go to their boundaries,
	// so no failure is left.
	const result = useAtomResult(useIssueBoundary().wrap(issue(props.id)));
	//    ^?
	return (
		<article>
			<h1>{result.value.title}</h1>
			<Suspense fallback={<p>Loading the assignee…</p>}>
				<Assignee issueId={props.id} />
			</Suspense>
		</article>
	);
}

function Assignee(props: { issueId: IssueId }) {
	const result = useAtomResult(
		useIssueBoundary().wrap(assignee(props.issueId)),
	);
	return <p>{result.value.name}</p>;
}
// #endregion component
