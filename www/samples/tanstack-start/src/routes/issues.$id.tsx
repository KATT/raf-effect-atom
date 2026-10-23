import type { IssueId } from "@examples/contract";
import { createFileRoute } from "@tanstack/react-router";
import { Schema } from "effect";
import { AsyncResult } from "effect/reactivity";
import { useAtomResult } from "raf-effect-atom";
import { Suspense } from "react";

import { IssueBoundary, useIssueBoundary } from "~/boundaries.tsx";
import { assignee, issue, IssueIdFromString } from "~/issues.ts";

// #region hero
// #region route
export const Route = createFileRoute("/issues/$id")({
	params: {
		parse: (params) => ({
			id: Schema.decodeSync(IssueIdFromString)(params.id),
		}),
	},
	loader: async ({ context, params }) => {
		// Starts the assignee; it streams in while the page renders.
		context.atoms.prefetch(assignee(params.id));
		// Waits for the issue, so the page renders with it.
		await context.atoms.ensure(issue(params.id));
	},
	component: () => (
		<IssueBoundary>
			<IssuePage />
		</IssueBoundary>
	),
});
// #endregion route

// #region component
function IssuePage() {
	const { id } = Route.useParams();
	// IssueNotFound and Unauthorized go to their boundaries.
	const result = useAtomResult(useIssueBoundary().wrap(issue(id)));
	//    ^?
	if (AsyncResult.isFailure(result)) {
		// RpcClientError, the only failure left.
		return <p>Couldn't reach the server.</p>;
	}
	return (
		<article>
			<h1>{result.value.title}</h1>
			<Suspense fallback={<p>Loading the assignee…</p>}>
				<Assignee issueId={id} />
			</Suspense>
		</article>
	);
}

function Assignee(props: { issueId: IssueId }) {
	const result = useAtomResult(
		useIssueBoundary().wrap(assignee(props.issueId)),
	);
	if (AsyncResult.isFailure(result)) {
		// RpcClientError, as for the issue.
		return <p>Couldn't load the assignee.</p>;
	}
	return <p>{result.value.name}</p>;
}
// #endregion component
// #endregion hero
