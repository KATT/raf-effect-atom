declare module "virtual:docs-manifest" {
	import type { DocSection } from "~/content/types.ts";

	export const sections: ReadonlyArray<DocSection>;
}

declare module "*.md" {
	import type { Doc } from "~/content/types.ts";

	const doc: Doc;
	export default doc;
}

declare module "sample:*" {
	import type { Sample } from "~/content/types.ts";

	const sample: Sample;
	export default sample;
}

declare module "virtual:docs-api" {
	import type { Doc } from "~/content/types.ts";

	/** The API reference's pages, which have no file, by slug. */
	export const pages: Record<string, () => Promise<{ default: Doc }>>;
}

declare module "virtual:docs-search" {
	/** The search index's JSON, for `loadSearchIndex`. */
	const index: string;
	export default index;
}
