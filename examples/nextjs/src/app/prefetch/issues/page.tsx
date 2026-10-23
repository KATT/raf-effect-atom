import { HydrationBoundary } from "raf-effect-atom";

import { atoms } from "~/atoms.server.ts";
import { IssuesPage } from "~/components/pages.tsx";
import { issueCounts, issuePage } from "~/issues.ts";
import { listSearchParams } from "~/params.ts";

export default async function Page(props: {
	readonly searchParams: Promise<unknown>;
}) {
	const input = await listSearchParams(props.searchParams);
	// Starts both atoms and renders their handles at once: the page shows
	// skeletons until their results stream in.
	const handles = {
		counts: atoms.prefetch(issueCounts),
		page: atoms.prefetch(issuePage, input, 0),
	};
	return (
		<HydrationBoundary registry={atoms.getRegistry()}>
			<IssuesPage handles={handles} input={input} verb="prefetch" />
		</HydrationBoundary>
	);
}
