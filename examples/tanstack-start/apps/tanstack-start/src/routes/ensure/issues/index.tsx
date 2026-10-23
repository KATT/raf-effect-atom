import { IssueListInput } from "@examples/contract";
import { createFileRoute } from "@tanstack/react-router";
import { Schema } from "effect";

import { IssuesPage } from "~/components/pages.tsx";
import { issueCounts, issuePage } from "~/issues.ts";

export const Route = createFileRoute("/ensure/issues/")({
	validateSearch: Schema.toStandardSchemaV1(IssueListInput),
	loaderDeps: (args) => args.search,
	loader: async (args) => {
		// Waits for results the registry doesn't hold yet; one it holds
		// renders at once, without a request.
		await Promise.all([
			args.context.atoms.ensure(issueCounts),
			args.context.atoms.ensure(issuePage(args.deps, 0)),
		]);
	},
	component: Page,
});

function Page() {
	return <IssuesPage input={Route.useSearch()} verb="ensure" />;
}
