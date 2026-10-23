import { dehydrate, fetch, HydrateAtoms } from "raf-effect-atom/next";

import { IssuesPage } from "~/components/pages.tsx";
import { forwardCookie } from "~/forward-cookie.ts";
import { issueCounts, issuePage } from "~/issues.ts";
import { listSearchParams } from "~/params.ts";

export default async function Page(props: {
	readonly searchParams: Promise<unknown>;
}) {
	const input = await listSearchParams(props.searchParams);
	await forwardCookie();
	// Waits for fresh results.
	await Promise.all([fetch(issueCounts), fetch(issuePage(input, 0))]);
	return (
		<HydrateAtoms state={dehydrate()}>
			<IssuesPage input={input} verb="fetch" />
		</HydrateAtoms>
	);
}
