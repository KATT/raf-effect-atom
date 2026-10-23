import { IssueListInput } from "@examples/contract";
import { createFileRoute } from "@tanstack/react-router";
import { Schema } from "effect";

import { IssuesPage } from "~/components/pages.tsx";
import { issueCounts, issuePage } from "~/issues.ts";

export const Route = createFileRoute("/prefetch/issues/")({
	validateSearch: Schema.toStandardSchemaV1(IssueListInput),
	loaderDeps: (args) => args.search,
	loader: (args) => {
		// Starts both atoms and returns at once: the page shows skeletons
		// until their results stream in.
		args.context.atoms.prefetch(issueCounts);
		args.context.atoms.prefetch(issuePage(args.deps, 0));
	},
	component: Page,
});

function Page() {
	return <IssuesPage input={Route.useSearch()} verb="prefetch" />;
}
