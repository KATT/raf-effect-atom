import { HydrateAtoms } from "raf-effect-atom/next";

import { atoms } from "~/atoms.server.ts";
import { IssuePage } from "~/components/pages.tsx";
import { assignee, commentPage, issue } from "~/issues.ts";
import { issueIdParam } from "~/params.ts";

export default async function Page(props: {
	readonly params: Promise<{ readonly issueId: string }>;
}) {
	const issueId = await issueIdParam(props.params);
	// Starts every atom the page reads and renders their handles at once.
	const handles = {
		assignee: atoms.prefetch(assignee, issueId),
		comments: atoms.prefetch(commentPage, issueId, 0),
		issue: atoms.prefetch(issue, issueId),
	};
	return (
		<HydrateAtoms state={await atoms.dehydrate()}>
			<IssuePage handles={handles} issueId={issueId} />
		</HydrateAtoms>
	);
}
