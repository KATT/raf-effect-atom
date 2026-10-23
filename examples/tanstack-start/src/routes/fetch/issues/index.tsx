import { IssueListInput } from "@examples/contract";
import { createFileRoute } from "@tanstack/react-router";
import { Schema } from "effect";
import { Loader } from "raf-effect-atom";
import { RouteLoader } from "raf-effect-atom/tanstack-router";

import { IssuesPage } from "~/components/pages.tsx";
import { issueCounts, issuePage } from "~/issues.ts";

export const Route = createFileRoute("/fetch/issues/")({
	validateSearch: Schema.toStandardSchemaV1(IssueListInput),
	loaderDeps: (args) => args.search,
	loader: (args) =>
		// Waits for fresh results, refreshing any the registry holds.
		RouteLoader.all(args, {
			counts: Loader.fetch(issueCounts),
			page: Loader.fetch(issuePage, args.deps, 0),
		}),
	component: Page,
});

function Page() {
	return (
		<IssuesPage
			handles={Route.useLoaderData()}
			input={Route.useSearch()}
			verb="fetch"
		/>
	);
}
