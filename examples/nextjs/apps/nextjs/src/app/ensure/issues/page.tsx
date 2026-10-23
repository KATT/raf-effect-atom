import { dehydrate, ensure, HydrateAtoms } from "raf-effect-atom/next";

import { IssuesPage } from "~/components/pages.tsx";
import { forwardCookie } from "~/forward-cookie.ts";
import { issueCounts, issuePage } from "~/issues.ts";
import { listSearchParams } from "~/params.ts";

export default async function Page(props: {
	readonly searchParams: Promise<unknown>;
}) {
	const input = await listSearchParams(props.searchParams);
	await forwardCookie();
	// Waits for results the registry doesn't hold. Every navigation renders
	// on the server into a new request registry, so it waits like `fetch`.
	await Promise.all([ensure(issueCounts), ensure(issuePage(input, 0))]);
	return (
		<HydrateAtoms state={dehydrate()}>
			<IssuesPage input={input} verb="ensure" />
		</HydrateAtoms>
	);
}
