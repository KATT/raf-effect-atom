import type { IssueId } from "@examples/contract";
import { Effect } from "effect";
import { AsyncResult } from "effect/reactivity";
import { Loader, useAtomResult } from "raf-effect-atom";
import { Suspense } from "react";

import { useIssueBoundary } from "~/boundaries.tsx";
import { assignee, issue } from "~/issues.ts";

declare const atoms: Loader.Loader;
declare const id: IssueId;

// #region fetch-on-render
// No loader started these atoms, so each read starts its own request.
function IssuePage(props: { issueId: IssueId }) {
	// Starts GetIssue, and suspends until it settles.
	const result = useAtomResult(issue(props.issueId), useIssueBoundary());
	if (AsyncResult.isFailure(result)) {
		return <p>Couldn't reach the server.</p>;
	}
	return (
		<article>
			<h1>{result.value.title}</h1>
			<Suspense fallback={<p>Loading the assignee…</p>}>
				{/* Renders, and starts GetIssueAssignee, only now. */}
				<Assignee issueId={props.issueId} />
			</Suspense>
		</article>
	);
}

function Assignee(props: { issueId: IssueId }) {
	const result = useAtomResult(assignee(props.issueId), useIssueBoundary());
	return AsyncResult.isSuccess(result) ? <p>{result.value.name}</p> : null;
}
// #endregion fetch-on-render

// #region await-first
// The assignee starts only once the issue is in: two round trips.
await atoms.ensure(issue(id));
atoms.prefetch(assignee(id));
// #endregion await-first

// #region start-first
// Both start now; the loader waits only for the issue.
atoms.prefetch(assignee(id));
await atoms.ensure(issue(id));
// #endregion start-first

// #region await-both
// Both start now, and the loader waits for both.
const [issueResult, assigneeResult] = await Promise.all([
	atoms.ensure(issue(id)),
	atoms.ensure(assignee(id)),
]);
// #endregion await-both

// #region effect-all
// Effect.all runs its effects one after another unless it's given a
// concurrency: without it, the assignee would start after the issue settled.
const both = Effect.all(
	//    ^?
	[Loader.ensure(issue(id)), Loader.ensure(assignee(id))],
	{ concurrency: "unbounded" },
);
// #endregion effect-all
