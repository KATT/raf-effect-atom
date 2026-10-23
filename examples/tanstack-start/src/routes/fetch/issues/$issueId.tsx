import { createFileRoute } from "@tanstack/react-router";

import { IssuePage } from "~/components/pages.tsx";
import { assignee, commentPage, issue } from "~/issues.ts";
import { issueIdParams } from "~/params.ts";

export const Route = createFileRoute("/fetch/issues/$issueId")({
	params: issueIdParams,
	loader: async (args) => {
		// The assignee and the comments stream in; the page waits for a
		// fresh issue, refreshing one the registry holds.
		args.context.atoms.prefetch(assignee(args.params.issueId));
		args.context.atoms.prefetch(commentPage(args.params.issueId, 0));
		await args.context.atoms.fetch(issue(args.params.issueId));
	},
	component: Page,
});

function Page() {
	return <IssuePage issueId={Route.useParams().issueId} />;
}
