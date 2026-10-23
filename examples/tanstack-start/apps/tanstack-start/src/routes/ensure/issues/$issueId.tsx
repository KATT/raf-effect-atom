import { createFileRoute } from "@tanstack/react-router";

import { IssuePage } from "~/components/pages.tsx";
import { assignee, commentPage, issue } from "~/issues.ts";
import { issueIdParams } from "~/params.ts";

export const Route = createFileRoute("/ensure/issues/$issueId")({
	params: issueIdParams,
	loader: async (args) => {
		const atoms = args.context.atoms;
		const id = args.params.issueId;
		// The assignee and the comments stream in; the page waits for the
		// issue, unless the registry holds it already.
		const assigneeHandle = atoms.prefetch(assignee, id);
		const comments = atoms.prefetch(commentPage, id, 0);
		const issueHandle = await atoms.ensure(issue, id);
		return { assignee: assigneeHandle, comments, issue: issueHandle };
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
