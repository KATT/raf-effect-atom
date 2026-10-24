import type { IssueId } from "@examples/contract";
import { Match, Option } from "effect";
import { AsyncResult } from "effect/reactivity";
import { type Handle, useAtomResult } from "raf-effect-atom";

import { useAppBoundary, useIssueBoundary } from "~/boundaries.tsx";
import { assignee, issue } from "~/issues.ts";

// #region fetch-in-render
// Reads take the handle a loader returned. An id would start the request
// in render, so it isn't one.
function Assignee(props: { assignee: Handle<typeof assignee> }) {
	const result = useIssueBoundary(useAtomResult(assignee, props.assignee));
	return <p>{result.value.name}</p>;
}

function IssuePage(props: { issueId: IssueId }) {
	// @ts-expect-error -- 2739: an IssueId isn't a handle
	return <Assignee assignee={props.issueId} />;
}
// #endregion fetch-in-render

// #region forgotten-tag
// The app boundary claims RpcClientError: IssueNotFound and Unauthorized
// are left.
function IssueTitle(props: { issue: Handle<typeof issue> }) {
	const result = useAppBoundary(useAtomResult(issue, props.issue));
	if (AsyncResult.isSuccess(result)) {
		return <h1>{result.value.title}</h1>;
	}
	return Option.match(AsyncResult.error(result), {
		onNone: () => <p>The server died.</p>,
		onSome: (error) =>
			// @ts-expect-error -- 2345: Unauthorized has no handler
			Match.valueTags(error, {
				IssueNotFound: (notFound) => <p>There's no issue #{notFound.id}.</p>,
			}),
	});
}
// #endregion forgotten-tag

export { IssuePage, IssueTitle };
