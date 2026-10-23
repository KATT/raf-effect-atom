import { IssueListInput } from "@examples/contract";
import { createFileRoute } from "@tanstack/react-router";
import { Schema } from "effect";

import { IssuesPage } from "~/components/pages.tsx";
import { issueCounts, issuePage } from "~/issues.ts";

export const Route = createFileRoute("/fetch/issues/")({
	validateSearch: Schema.toStandardSchemaV1(IssueListInput),
	loaderDeps: (args) => args.search,
	loader: async (args) => {
		// Waits for fresh results, refreshing any the registry holds.
		await Promise.all([
			args.context.atoms.fetch(issueCounts),
			args.context.atoms.fetch(issuePage(args.deps, 0)),
		]);
	},
	component: Page,
});

function Page() {
	return <IssuesPage input={Route.useSearch()} verb="fetch" />;
}
