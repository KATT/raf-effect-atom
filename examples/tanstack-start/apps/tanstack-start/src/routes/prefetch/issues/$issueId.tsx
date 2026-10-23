import { createFileRoute } from "@tanstack/react-router";

import { IssuePage } from "~/components/pages.tsx";
import { assignee, commentPage, issue } from "~/issues.ts";
import { issueIdParams } from "~/params.ts";

export const Route = createFileRoute("/prefetch/issues/$issueId")({
	params: issueIdParams,
	loader: (args) => {
		const atoms = args.context.atoms;
		const id = args.params.issueId;
		// Starts every atom the page reads and returns their handles at once.
		return {
			assignee: atoms.prefetch(assignee, id),
			comments: atoms.prefetch(commentPage, id, 0),
			issue: atoms.prefetch(issue, id),
		};
	},
	component: Page,
});

function Page() {
	return (
		<IssuePage
			handles={Route.useLoaderData()}
			issueId={Route.useParams().issueId}
		/>
	);
}
