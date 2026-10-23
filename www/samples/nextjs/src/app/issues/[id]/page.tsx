import { Schema } from "effect";
import { HydrationBoundary } from "raf-effect-atom";
import { ensure, getRegistry, prefetch } from "raf-effect-atom/rsc";

import { IssueBoundary } from "~/boundaries.tsx";
import { IssuePage } from "~/components/issue-page.tsx";
import { assignee, issue, IssueIdFromString } from "~/issues.ts";

// #region page
export default async function Page(props: { params: Promise<{ id: string }> }) {
	const id = Schema.decodeSync(IssueIdFromString)((await props.params).id);
	// Starts the assignee; it streams in while the page renders.
	const assigneeHandle = prefetch(assignee, id);
	// Waits for the issue, so the page renders with it.
	const issueHandle = await ensure(issue, id);
	return (
		// The request registry's results go to the browser, still-loading ones
		// as promises.
		<HydrationBoundary registry={getRegistry()}>
			<IssueBoundary>
				<IssuePage assignee={assigneeHandle} issue={issueHandle} />
			</IssueBoundary>
		</HydrationBoundary>
	);
}
// #endregion page
