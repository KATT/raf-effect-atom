import { Schema } from "effect";
import { type Handle, HydrationBoundary, useAtomResult } from "raf-effect-atom";
import { Suspense } from "react";

import { atomsContext } from "~/atoms.ts";
import { IssueBoundary, useIssueBoundary } from "~/boundaries.tsx";
import { assignee, issue, IssueIdFromString } from "~/issues.ts";

import type { Route } from "./+types/issues.$id";

// #region hero
// #region loader
async function load({ context, params }: Route.LoaderArgs) {
	const id = Schema.decodeSync(IssueIdFromString)(params.id);
	const atoms = context.get(atomsContext);
	const handles = {
		// Starts the assignee; it streams in while the page renders.
		assignee: atoms.prefetch(assignee, id),
		// Waits for the issue, so the page renders with it.
		issue: await atoms.ensure(issue, id),
	};
	// The registry's results go to the browser, still-loading ones as promises.
	return { atoms: atoms.dehydrate(), handles };
}

// The first page loads on the server; after it, the same function runs in
// the browser, where `ensure` finds what the registry already holds.
export const loader = load;
export const clientLoader = load;

export default function Page({ loaderData }: Route.ComponentProps) {
	return (
		<HydrationBoundary state={loaderData.atoms}>
			<IssueBoundary>
				<IssuePage {...loaderData.handles} />
			</IssueBoundary>
		</HydrationBoundary>
	);
}
// #endregion loader

// #region component
function IssuePage(props: {
	assignee: Handle<typeof assignee>;
	issue: Handle<typeof issue>;
}) {
	// IssueNotFound, Unauthorized and RpcClientError go to their boundaries,
	// so no failure is left.
	const result = useIssueBoundary(useAtomResult(issue, props.issue));
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

// Takes the handle the loader returned, not an id: it reads a request that
// already started, and can't start its own.
function Assignee(props: { assignee: Handle<typeof assignee> }) {
	const result = useIssueBoundary(useAtomResult(assignee, props.assignee));
	return <p>{result.value.name}</p>;
}
// #endregion component
// #endregion hero
