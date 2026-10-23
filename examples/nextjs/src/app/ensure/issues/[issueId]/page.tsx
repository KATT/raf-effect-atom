import { HydrationBoundary } from "raf-effect-atom";

import { atoms } from "~/atoms.server.ts";
import { IssuePage } from "~/components/pages.tsx";
import { assignee, commentPage, issue } from "~/issues.ts";
import { issueIdParam } from "~/params.ts";

export default async function Page(props: {
	readonly params: Promise<{ readonly issueId: string }>;
}) {
	const issueId = await issueIdParam(props.params);
	// The assignee and the comments stream in; the page waits for the issue,
	// which a new request registry never holds yet.
	const handles = {
		assignee: atoms.prefetch(assignee, issueId),
		comments: atoms.prefetch(commentPage, issueId, 0),
		issue: await atoms.ensure(issue, issueId),
	};
	return (
		<HydrationBoundary registry={atoms.getRegistry()}>
			<IssuePage handles={handles} issueId={issueId} />
		</HydrationBoundary>
	);
}
