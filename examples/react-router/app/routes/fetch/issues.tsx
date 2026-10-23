import { HydrationBoundary } from "raf-effect-atom";

import { atomsContext } from "~/atoms.ts";
import { IssuesPage } from "~/components/pages.tsx";
import { issueCounts, issuePage } from "~/issues.ts";
import { parseListInput } from "~/params.ts";

import type { Route } from "./+types/issues";

export async function loader(args: Route.LoaderArgs) {
	const input = parseListInput(args.request);
	const atoms = args.context.get(atomsContext);
	// Always waits for fresh results.
	await Promise.all([
		atoms.fetch(issueCounts),
		atoms.fetch(issuePage(input, 0)),
	]);
	return { atoms: atoms.dehydrate(), input };
}

export default function Page(props: Route.ComponentProps) {
	return (
		<HydrationBoundary state={props.loaderData.atoms}>
			<IssuesPage input={props.loaderData.input} verb="fetch" />
		</HydrationBoundary>
	);
}
