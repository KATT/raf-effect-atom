import { HydrationBoundary } from "raf-effect-atom";

import { atomsContext } from "~/atoms.ts";
import { IssuePage } from "~/components/pages.tsx";
import { assignee, commentPage, issue } from "~/issues.ts";
import { parseIssueId } from "~/params.ts";

import type { Route } from "./+types/issue";

export async function loader(args: Route.LoaderArgs) {
	const issueId = parseIssueId(args.params.issueId);
	const atoms = args.context.get(atomsContext);
	// The assignee and the comments stream in; the page waits for a fresh
	// issue.
	const handles = {
		assignee: atoms.prefetch(assignee, issueId),
		comments: atoms.prefetch(commentPage, issueId, 0),
		issue: await atoms.fetch(issue, issueId),
	};
	return { atoms: atoms.dehydrate(), handles, issueId };
}

export default function Page(props: Route.ComponentProps) {
	return (
		<HydrationBoundary state={props.loaderData.atoms}>
			<IssuePage
				handles={props.loaderData.handles}
				issueId={props.loaderData.issueId}
			/>
		</HydrationBoundary>
	);
}
