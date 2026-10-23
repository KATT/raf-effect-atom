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
		const [counts, page] = await Promise.all([
			args.context.atoms.fetch(issueCounts),
			args.context.atoms.fetch(issuePage, args.deps, 0),
		]);
		return { counts, page };
	},
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
