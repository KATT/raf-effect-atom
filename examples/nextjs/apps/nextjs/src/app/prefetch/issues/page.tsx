import { dehydrate, HydrateAtoms, prefetch } from "raf-effect-atom/next";

import { IssuesPage } from "~/components/pages.tsx";
import { forwardCookie } from "~/forward-cookie.ts";
import { issueCounts, issuePage } from "~/issues.ts";
import { listSearchParams } from "~/params.ts";

export default async function Page(props: {
	readonly searchParams: Promise<unknown>;
}) {
	const input = await listSearchParams(props.searchParams);
	await forwardCookie();
	// Starts both atoms and renders their handles at once: the page shows
	// skeletons until their results stream in.
	const handles = {
		counts: prefetch(issueCounts),
		page: prefetch(issuePage, input, 0),
	};
	return (
		<HydrateAtoms state={dehydrate()}>
			<IssuesPage handles={handles} input={input} verb="prefetch" />
		</HydrateAtoms>
	);
}
