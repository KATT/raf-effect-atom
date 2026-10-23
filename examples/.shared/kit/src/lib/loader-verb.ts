/** The loader verbs, each a section of the app's URLs: `/<verb>/issues/…`. */
export const loaderVerbs = ["prefetch", "ensure", "fetch"] as const;
export type LoaderVerb = (typeof loaderVerbs)[number];
const DEFAULT_LOADER_VERB: LoaderVerb = "prefetch";

const isLoaderVerb = (value: string): value is LoaderVerb =>
	loaderVerbs.some((verb) => verb === value);

/** The verb a path starts with, or the default outside `/<verb>/…`. */
export function loaderVerbOf(pathname: string): LoaderVerb {
	const first = pathname.split("/")[1] ?? "";
	return isLoaderVerb(first) ? first : DEFAULT_LOADER_VERB;
}

/**
 * The same page and search under another verb. Outside `/<verb>/…` it goes
 * to the list.
 */
export function withLoaderVerb(
	location: { readonly pathname: string; readonly search: string },
	verb: LoaderVerb,
) {
	const [, first = "", ...rest] = location.pathname.split("/");
	if (!isLoaderVerb(first)) {
		return `/${verb}/issues`;
	}
	return `/${[verb, ...rest].join("/")}${location.search}`;
}
