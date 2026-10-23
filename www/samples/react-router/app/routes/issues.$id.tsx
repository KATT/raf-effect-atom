import type { IssueId } from "@examples/contract";
import { Schema } from "effect";
import { HydrationBoundary, useAtomResult } from "raf-effect-atom";
import { Suspense } from "react";

import { atomsContext } from "~/atoms.ts";
import { IssueBoundary, useIssueBoundary } from "~/boundaries.tsx";
import { assignee, issue, IssueIdFromString } from "~/issues.ts";

import type { Route } from "./+types/issues.$id";

// #region hero
// #region loader
export async function loader({ context, params }: Route.LoaderArgs) {
	const id = Schema.decodeSync(IssueIdFromString)(params.id);
	const atoms = context.get(atomsContext);
	// Starts the assignee; it streams in while the page renders.
	atoms.prefetch(assignee(id));
	// Waits for the issue, so the page renders with it.
	await atoms.ensure(issue(id));
	// The registry's results go to the browser, still-loading ones as promises.
	return { atoms: atoms.dehydrate(), id };
}

export default function Page({ loaderData }: Route.ComponentProps) {
	return (
		<HydrationBoundary state={loaderData.atoms}>
			<IssueBoundary>
				<IssuePage id={loaderData.id} />
			</IssueBoundary>
		</HydrationBoundary>
	);
}
// #endregion loader

// #region component
function IssuePage(props: { id: IssueId }) {
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
// #endregion hero
