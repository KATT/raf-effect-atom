import { HydrateAtoms } from "raf-effect-atom/next";

import { atoms } from "~/atoms.server.ts";
import { IssuePage } from "~/components/pages.tsx";
import { assignee, commentPage, issue } from "~/issues.ts";
import { issueIdParam } from "~/params.ts";

export default async function Page(props: {
	readonly params: Promise<{ readonly issueId: string }>;
}) {
	const issueId = await issueIdParam(props.params);
	// The assignee and the comments stream in; the page waits for a fresh
	// issue.
	const handles = {
		assignee: atoms.prefetch(assignee, issueId),
		comments: atoms.prefetch(commentPage, issueId, 0),
		issue: await atoms.fetch(issue, issueId),
	};
	return (
		<HydrateAtoms state={await atoms.dehydrate()}>
			<IssuePage handles={handles} issueId={issueId} />
		</HydrateAtoms>
	);
}
