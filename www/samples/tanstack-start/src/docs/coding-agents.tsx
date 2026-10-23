import type { IssueId } from "@examples/contract";
import { Match, Option } from "effect";
import { AsyncResult } from "effect/reactivity";
import { useAtomResult } from "raf-effect-atom";

import { useIssueBoundary } from "~/boundaries.tsx";
import { assignee, issue } from "~/issues.ts";

// #region fetch-in-render
// No loader started the assignee, so in development this read throws.
function Assignee(props: { issueId: IssueId }) {
	const result = useAtomResult(
		useIssueBoundary().wrap(assignee(props.issueId)),
	);
	return <p>{result.value.name}</p>;
}
// #endregion fetch-in-render

// #region forgotten-tag
function IssueTitle(props: { id: IssueId }) {
	const result = useAtomResult(issue(props.id));
	if (AsyncResult.isSuccess(result)) {
		return <h1>{result.value.title}</h1>;
	}
	return Option.match(AsyncResult.error(result), {
		onNone: () => <p>The server died.</p>,
		onSome: (error) =>
			// @ts-expect-error -- 2345: RpcClientError has no handler
			Match.valueTags(error, {
				IssueNotFound: (notFound) => <p>There's no issue #{notFound.id}.</p>,
				Unauthorized: () => <p>Sign in to see this issue.</p>,
			}),
	});
}
// #endregion forgotten-tag

export { Assignee, IssueTitle };
