import { createFileRoute } from "@tanstack/react-router";
import { Schema } from "effect";
import { type Handle, useAtomResult } from "raf-effect-atom";
import { Suspense } from "react";

import { useAuthBoundary } from "~/boundaries.tsx";
import { searchIssues } from "~/issues.ts";

// #region search
export const Route = createFileRoute("/search")({
	validateSearch: Schema.toStandardSchemaV1(
		Schema.Struct({ q: Schema.optional(Schema.String) }),
	),
	loaderDeps: ({ search }) => ({ q: search.q }),
	loader: ({ context, deps }) => ({
		// Starts the search the URL names, if it names one.
		results:
			deps.q === undefined
				? undefined
				: context.atoms.prefetch(searchIssues, deps.q),
	}),
	component: SearchPage,
});

function SearchPage() {
	const search = Route.useSearch();
	const navigate = Route.useNavigate();
	const data = Route.useLoaderData();
	return (
		<search>
			<input
				aria-label="Search issues"
				defaultValue={search.q}
				onChange={(event) => {
					void navigate({
						replace: true,
						search: { q: event.target.value || undefined },
					});
				}}
				type="search"
			/>
			{data.results === undefined ? null : (
				<Suspense fallback={<p>Searching…</p>}>
					<SearchResults results={data.results} />
				</Suspense>
			)}
		</search>
	);
}

function SearchResults(props: { results: Handle<typeof searchIssues> }) {
	// The auth and app boundaries claim Unauthorized and RpcClientError.
	const result = useAtomResult(
		//    ^?
		useAuthBoundary(searchIssues),
		props.results,
	);
	return (
		<ul>
			{result.value.map((found) => (
				<li key={found.id}>{found.title}</li>
			))}
		</ul>
	);
}
// #endregion search
