import { createFileRoute } from "@tanstack/react-router";

import { IssuePage } from "~/components/pages.tsx";
import { assignee, commentPage, issue } from "~/issues.ts";
import { issueIdParams } from "~/params.ts";

export const Route = createFileRoute("/prefetch/issues/$issueId")({
	params: issueIdParams,
	loader: (args) => {
		// Starts every atom the page reads and returns at once.
		args.context.atoms.prefetch(issue(args.params.issueId));
		args.context.atoms.prefetch(assignee(args.params.issueId));
		args.context.atoms.prefetch(commentPage(args.params.issueId, 0));
	},
	component: Page,
});

function Page() {
	return <IssuePage issueId={Route.useParams().issueId} />;
}
