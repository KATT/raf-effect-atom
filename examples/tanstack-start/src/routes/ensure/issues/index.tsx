import { IssueListInput } from "@examples/contract";
import { createFileRoute } from "@tanstack/react-router";
import { Schema } from "effect";
import { Loader } from "raf-effect-atom";
import { RouteLoader } from "raf-effect-atom/tanstack-router";

import { IssuesPage } from "~/components/pages.tsx";
import { issueCounts, issuePage } from "~/issues.ts";

export const Route = createFileRoute("/ensure/issues/")({
	validateSearch: Schema.toStandardSchemaV1(IssueListInput),
	loaderDeps: (args) => args.search,
	loader: (args) =>
		// Waits for results the registry doesn't hold yet; one it holds
		// renders at once, without a request.
		RouteLoader.all(args, {
			counts: Loader.ensure(issueCounts),
			page: Loader.ensure(issuePage, args.deps, 0),
		}),
	component: Page,
});

function Page() {
	return (
		<IssuesPage
			handles={Route.useLoaderData()}
			input={Route.useSearch()}
			verb="ensure"
		/>
	);
}
