// #region component
"use client";
// #endregion

import { type Handle, useAtomResult } from "raf-effect-atom";
import { Suspense } from "react";

import { useIssueBoundary } from "~/boundaries.tsx";
import { assignee, issue } from "~/issues.ts";

// #region component
export function IssuePage(props: {
	assignee: Handle<typeof assignee>;
	issue: Handle<typeof issue>;
}) {
	// IssueNotFound, Unauthorized and RpcClientError go to their boundaries,
	// so no failure is left.
	const result = useAtomResult(useIssueBoundary().wrap(issue), props.issue);
	//    ^?
	return (
		<article>
			<h1>{result.value.title}</h1>
			<Suspense fallback={<p>Loading the assignee…</p>}>
				<Assignee assignee={props.assignee} />
			</Suspense>
		</article>
	);
}

// Takes the handle the server component passed, not an id: it reads a
// request that already started, and can't start its own.
function Assignee(props: { assignee: Handle<typeof assignee> }) {
	const result = useAtomResult(
		useIssueBoundary().wrap(assignee),
		props.assignee,
	);
	return <p>{result.value.name}</p>;
}
// #endregion component
