import { createFileRoute } from "@tanstack/react-router";
import { Schema } from "effect";
import { type Handle, useAtomResult } from "raf-effect-atom";
import { Suspense } from "react";

import { IssueBoundary, useIssueBoundary } from "~/boundaries.tsx";
import { assignee, issue, IssueParams } from "~/issues.ts";

// #region hero
// #region route
export const Route = createFileRoute("/issues/$id")({
	params: {
		parse: (params) => Schema.decodeUnknownSync(IssueParams)(params),
		stringify: Schema.encodeSync(IssueParams),
	},
	loader: async ({ context, params }) => ({
		// Starts the assignee; it streams in while the page renders.
		assignee: context.atoms.prefetch(assignee, params.id),
		// Waits for the issue, so the page renders with it.
		issue: await context.atoms.ensure(issue, params.id),
	}),
	component: () => (
		<IssueBoundary>
			<IssuePage />
		</IssueBoundary>
	),
});
// #endregion route

// #region component
function IssuePage() {
	const data = Route.useLoaderData();
	// IssueNotFound, Unauthorized and RpcClientError go to their boundaries,
	// so no failure is left.
	const result = useAtomResult(useIssueBoundary(issue), data.issue);
	//    ^?
	return (
		<article>
			<h1>{result.value.title}</h1>
			<Suspense fallback={<p>Loading the assignee…</p>}>
				<Assignee assignee={data.assignee} />
			</Suspense>
		</article>
	);
}

// Takes the handle the loader returned, not an id: it reads a request that
// already started, and can't start its own.
function Assignee(props: { assignee: Handle<typeof assignee> }) {
	const result = useAtomResult(useIssueBoundary(assignee), props.assignee);
	return <p>{result.value.name}</p>;
}
// #endregion component
// #endregion hero
