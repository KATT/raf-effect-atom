import { createContext, use } from "react";
import { Link, type LinkProps } from "react-router";

import { type Prefetch, toLinkPrefetch } from "~/settings.ts";

/** The top bar's "Prefetch links" choice, for every link in the app. */
export const PrefetchContext = createContext<Prefetch>("off");

/**
 * A `Link` that prefetches the way the settings say. React Router prefetches
 * the route's modules and its loaders' `.data`.
 */
export function AppLink(props: LinkProps) {
	const prefetch = use(PrefetchContext);
	return <Link prefetch={toLinkPrefetch(prefetch)} {...props} />;
}
