import { Effect, Schema } from "effect";
import { AsyncResult, Atom } from "effect/reactivity";
import { pages as apiPages } from "virtual:docs-api";
import { sections } from "virtual:docs-manifest";

import { Doc, type DocMeta } from "./types.ts";

export { sections } from "virtual:docs-manifest";

export const allDocs: ReadonlyArray<DocMeta> = sections.flatMap(
	(section) => section.docs,
);

export const firstDoc = allDocs[0]?.slug ?? "overview";

export function findDoc(slug: string): DocMeta | undefined {
	return allDocs.find((doc) => doc.slug === slug);
}

/** The pages before and after `slug` in sidebar order. */
export function neighbours(slug: string) {
	const index = allDocs.findIndex((doc) => doc.slug === slug);
	return {
		next: index === -1 ? undefined : allDocs[index + 1],
		previous: index <= 0 ? undefined : allDocs[index - 1],
	};
}

// Each page is its own content-hashed chunk: the browser downloads a page
// once per deploy and the CDN can cache it forever.
const pages = import.meta.glob<{ default: Doc }>([
	"/content/*.md",
	"!/content/_*.md",
]);

const DocResult = AsyncResult.Schema({ error: Schema.Never, success: Doc });

/**
 * A docs page, compiled at build time. Content only changes with a deploy,
 * so the atom is kept alive: once a page is loaded (or hovered), going back
 * to it is instant. It's serializable, so the prerendered page carries it
 * into the browser's registry.
 */
function makeDocAtom(slug: string) {
	return Atom.make(
		Effect.promise(async () => {
			const load = pages[`/content/${slug}.md`] ?? apiPages[slug];
			if (!load) {
				throw new Error(`No page "${slug}"`);
			}
			const page = await load();
			return page.default;
		}),
	).pipe(
		Atom.keepAlive,
		Atom.serializable({ key: `doc:${slug}`, schema: DocResult }),
		Atom.withLabel(`doc:${slug}`),
	);
}

export const docAtom = Atom.family(makeDocAtom);
