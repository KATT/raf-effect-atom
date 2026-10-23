import { createFileRoute } from "@tanstack/react-router";
import { Loader } from "raf-effect-atom";
import { RouteLoader } from "raf-effect-atom/tanstack-router";

import { IssuePage } from "~/components/pages.tsx";
import { assignee, commentPage, issue } from "~/issues.ts";
import { issueIdParams } from "~/params.ts";

export const Route = createFileRoute("/fetch/issues/$issueId")({
	params: issueIdParams,
	loader: (args) =>
		// The assignee and the comments stream in; the page waits for a
		// fresh issue, refreshing one the registry holds.
		RouteLoader.all(args, {
			assignee: Loader.prefetch(assignee, args.params.issueId),
			comments: Loader.prefetch(commentPage, args.params.issueId, 0),
			issue: Loader.fetch(issue, args.params.issueId),
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
