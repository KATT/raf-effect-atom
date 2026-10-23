import {
	dehydrate,
	ensure,
	HydrateAtoms,
	prefetch,
} from "raf-effect-atom/next";

import { IssuePage } from "~/components/pages.tsx";
import { forwardCookie } from "~/forward-cookie.ts";
import { assignee, commentPage, issue } from "~/issues.ts";
import { issueIdParam } from "~/params.ts";

export default async function Page(props: {
	readonly params: Promise<{ readonly issueId: string }>;
}) {
	const issueId = await issueIdParam(props.params);
	await forwardCookie();
	// The assignee and the comments stream in; the page waits for the issue,
	// which a new request registry never holds yet.
	prefetch(assignee(issueId));
	prefetch(commentPage(issueId, 0));
	await ensure(issue(issueId));
	return (
		<HydrateAtoms state={dehydrate()}>
			<IssuePage issueId={issueId} />
		</HydrateAtoms>
	);
}
