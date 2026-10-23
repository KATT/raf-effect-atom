import { dehydrate, HydrateAtoms, prefetch } from "raf-effect-atom/next";

import { IssuePage } from "~/components/pages.tsx";
import { forwardCookie } from "~/forward-cookie.ts";
import { assignee, commentPage, issue } from "~/issues.ts";
import { issueIdParam } from "~/params.ts";

export default async function Page(props: {
	readonly params: Promise<{ readonly issueId: string }>;
}) {
	const issueId = await issueIdParam(props.params);
	await forwardCookie();
	// Starts every atom the page reads and renders their handles at once.
	const handles = {
		assignee: prefetch(assignee, issueId),
		comments: prefetch(commentPage, issueId, 0),
		issue: prefetch(issue, issueId),
	};
	return (
		<HydrateAtoms state={dehydrate()}>
			<IssuePage handles={handles} issueId={issueId} />
		</HydrateAtoms>
	);
}
