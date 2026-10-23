import { dehydrate, fetch, HydrateAtoms, prefetch } from "raf-effect-atom/next";

import { IssuePage } from "~/components/pages.tsx";
import { forwardCookie } from "~/forward-cookie.ts";
import { assignee, commentPage, issue } from "~/issues.ts";
import { issueIdParam } from "~/params.ts";

export default async function Page(props: {
	readonly params: Promise<{ readonly issueId: string }>;
}) {
	const issueId = await issueIdParam(props.params);
	await forwardCookie();
	// The assignee and the comments stream in; the page waits for a fresh
	// issue.
	const handles = {
		assignee: prefetch(assignee, issueId),
		comments: prefetch(commentPage, issueId, 0),
		issue: await fetch(issue, issueId),
	};
	return (
		<HydrateAtoms state={dehydrate()}>
			<IssuePage handles={handles} issueId={issueId} />
		</HydrateAtoms>
	);
}
