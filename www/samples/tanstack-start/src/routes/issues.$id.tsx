import { createFileRoute } from "@tanstack/react-router";
import { Schema } from "effect";
import { type Handle, useAtomResult } from "raf-effect-atom";
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
	const handles = Route.useLoaderData();
	// IssueNotFound, Unauthorized and RpcClientError go to their boundaries,
	// so no failure is left.
	const result = useAtomResult(useIssueBoundary().wrap(issue), handles.issue);
	//    ^?
	return (
		<article>
			<h1>{result.value.title}</h1>
			<Suspense fallback={<p>Loading the assignee…</p>}>
				<Assignee assignee={handles.assignee} />
			</Suspense>
		</article>
	);
}

// Takes the handle the loader returned, not an id: it reads a request that
// already started, and can't start its own.
function Assignee(props: { assignee: Handle<typeof assignee> }) {
	const result = useAtomResult(
		useIssueBoundary().wrap(assignee),
		props.assignee,
	);
	return <p>{result.value.name}</p>;
}
// #endregion component
// #endregion hero
