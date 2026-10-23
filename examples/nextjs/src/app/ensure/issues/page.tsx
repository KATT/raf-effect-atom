import { HydrationBoundary } from "raf-effect-atom";

import { atoms } from "~/atoms.server.ts";
import { IssuesPage } from "~/components/pages.tsx";
import { issueCounts, issuePage } from "~/issues.ts";
import { listSearchParams } from "~/params.ts";

export default async function Page(props: {
	readonly searchParams: Promise<unknown>;
}) {
	const input = await listSearchParams(props.searchParams);
	// Waits for results the registry doesn't hold. Every navigation renders
	// on the server into a new request registry, so it waits like `fetch`.
	const [counts, page] = await Promise.all([
		atoms.ensure(issueCounts),
		atoms.ensure(issuePage, input, 0),
	]);
	return (
		<HydrationBoundary registry={atoms.getRegistry()}>
			<IssuesPage handles={{ counts, page }} input={input} verb="ensure" />
		</HydrationBoundary>
	);
}
