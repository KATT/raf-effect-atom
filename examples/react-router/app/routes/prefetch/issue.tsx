import { HydrationBoundary } from "raf-effect-atom";

import { atomsContext } from "~/atoms.ts";
import { IssuePage } from "~/components/pages.tsx";
import { assignee, commentPage, issue } from "~/issues.ts";
import { parseIssueId } from "~/params.ts";

import type { Route } from "./+types/issue";

export function loader(args: Route.LoaderArgs) {
	const issueId = parseIssueId(args.params.issueId);
	const atoms = args.context.get(atomsContext);
	// Starts every atom the page reads and returns at once.
	atoms.prefetch(issue(issueId));
	atoms.prefetch(assignee(issueId));
	atoms.prefetch(commentPage(issueId, 0));
	return { atoms: atoms.dehydrate(), issueId };
}

export default function Page(props: Route.ComponentProps) {
	return (
		<HydrationBoundary state={props.loaderData.atoms}>
			<IssuePage issueId={props.loaderData.issueId} />
		</HydrationBoundary>
	);
}
