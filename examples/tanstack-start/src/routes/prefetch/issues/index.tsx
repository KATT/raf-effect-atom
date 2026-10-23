import { IssueListInput } from "@examples/contract";
import { createFileRoute } from "@tanstack/react-router";
import { Schema } from "effect";
import { Loader } from "raf-effect-atom";
import { RouteLoader } from "raf-effect-atom/tanstack-router";

import { IssuesPage } from "~/components/pages.tsx";
import { issueCounts, issuePage } from "~/issues.ts";

export const Route = createFileRoute("/prefetch/issues/")({
	validateSearch: Schema.toStandardSchemaV1(IssueListInput),
	loaderDeps: (args) => args.search,
	loader: (args) =>
		// Starts both atoms and returns their handles at once: the page shows
		// skeletons until their results stream in.
		RouteLoader.all(args, {
			counts: Loader.prefetch(issueCounts),
			page: Loader.prefetch(issuePage, args.deps, 0),
		}),
	component: Page,
});

function Page() {
	return (
		<IssuesPage
			handles={Route.useLoaderData()}
			input={Route.useSearch()}
			verb="prefetch"
		/>
	);
}
