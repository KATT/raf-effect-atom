import { createFileRoute } from "@tanstack/react-router";
import { Loader } from "raf-effect-atom";
import { RouteLoader } from "raf-effect-atom/tanstack-router";

import { IssuePage } from "~/components/pages.tsx";
import { assignee, commentPage, issue } from "~/issues.ts";
import { issueIdParams } from "~/params.ts";

export const Route = createFileRoute("/prefetch/issues/$issueId")({
	params: issueIdParams,
	loader: (args) =>
		// Starts every atom the page reads and returns their handles at once.
		RouteLoader.all(args, {
			assignee: Loader.prefetch(assignee, args.params.issueId),
			comments: Loader.prefetch(commentPage, args.params.issueId, 0),
			issue: Loader.prefetch(issue, args.params.issueId),
		}),
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
