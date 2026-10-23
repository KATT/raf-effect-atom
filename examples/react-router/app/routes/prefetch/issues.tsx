import { HydrationBoundary } from "raf-effect-atom";

import { atomsContext } from "~/atoms.ts";
import { IssuesPage } from "~/components/pages.tsx";
import { issueCounts, issuePage } from "~/issues.ts";
import { parseListInput } from "~/params.ts";

import type { Route } from "./+types/issues";

function load(args: Route.LoaderArgs) {
	const input = parseListInput(args.request);
	const atoms = args.context.get(atomsContext);
	// Starts both atoms and returns their handles at once: the page shows
	// skeletons until their results stream in.
	const handles = {
		counts: atoms.prefetch(issueCounts),
		page: atoms.prefetch(issuePage, input, 0),
	};
	return { atoms: atoms.dehydrate(), handles, input };
}

export const loader = load;
// After the first page, the same loader runs in the browser, over its
// registry.
export const clientLoader = load;

export default function Page(props: Route.ComponentProps) {
	return (
		<HydrationBoundary state={props.loaderData.atoms}>
			<IssuesPage
				handles={props.loaderData.handles}
				input={props.loaderData.input}
				verb="prefetch"
			/>
		</HydrationBoundary>
	);
}
