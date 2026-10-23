import { Schema } from "effect";

export const DocHeading = Schema.Struct({
	depth: Schema.Literals([2, 3]),
	id: Schema.String,
	text: Schema.String,
});
export type DocHeading = typeof DocHeading.Type;

export const DocSegment = Schema.Union([
	Schema.Struct({ html: Schema.String, kind: Schema.Literal("html") }),
	Schema.Struct({ id: Schema.String, kind: Schema.Literal("demo") }),
]);
export type DocSegment = typeof DocSegment.Type;

const docMetaFields = {
	/** Ids of the demos the page embeds, so its loader can prefetch them. */
	demos: Schema.Array(Schema.String),
	description: Schema.String,
	/** For the API reference: what the page is generated from, from the repository's root. */
	generatedFrom: Schema.optional(Schema.String),
	headings: Schema.Array(DocHeading),
	/** ISO date of the source file's last commit, when git knows it. */
	lastModified: Schema.optional(Schema.String),
	section: Schema.String,
	slug: Schema.String,
	title: Schema.String,
};

/** What every page needs to know about every other: nav, search, SEO. */
export const DocMeta = Schema.Struct(docMetaFields);
export type DocMeta = typeof DocMeta.Type;

export const Doc = Schema.Struct({
	...docMetaFields,
	segments: Schema.Array(DocSegment),
});
export type Doc = typeof Doc.Type;

/** A region of a sample app's file, from a `sample:` import. */
export interface Sample {
	readonly segments: ReadonlyArray<DocSegment>;
}

export interface DocSection {
	readonly docs: ReadonlyArray<DocMeta>;
	readonly title: string;
}
