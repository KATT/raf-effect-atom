import { Schema } from "effect";
import MiniSearch, { type Options, type SearchResult } from "minisearch";
import { stemmer } from "stemmer";

import { synonymGroups } from "./synonyms.ts";

/** A page as the index reads it: its frontmatter and the prose of each section. */
export interface SearchPage {
	readonly description: string;
	readonly headings: ReadonlyArray<{
		readonly id: string;
		readonly text: string;
	}>;
	readonly section: string;
	/** Each section's prose, by heading id; `undefined` is the intro. */
	readonly sections: ReadonlyArray<{
		readonly id: string | undefined;
		readonly text: string;
	}>;
	readonly slug: string;
	readonly title: string;
}

/** A page, or a heading on one. */
export interface SearchHit {
	/** The page's sidebar section for a page, the page's title for a heading. */
	readonly context: string;
	readonly hash: string | undefined;
	readonly id: string;
	readonly slug: string;
	readonly title: string;
}

interface SearchDocument extends SearchHit {
	readonly body: string;
	readonly description: string;
	/** The page's title, on its headings. */
	readonly page: string;
}

const stopWords = new Set(
	"a an and are as at be by can do does for from how i in is it its of on or that the this to what when with".split(
		" ",
	),
);

const wordPattern = /[\p{L}\p{N}]+/gu;
const identifierPartPattern = /\p{Lu}?\p{Ll}+|\p{Lu}+(?!\p{Ll})|\p{N}+/gu;

function words(text: string): ReadonlyArray<string> {
	return text.match(wordPattern) ?? [];
}

/** `useAtomResult` → `use`, `Atom`, `Result`; nothing for a plain word. */
function identifierParts(word: string): ReadonlyArray<string> {
	const parts = word.match(identifierPartPattern) ?? [];
	return parts.length > 1 ? parts : [];
}

/** Lowercase and stemmed, so `Boundaries` and `boundary` are one term. */
function processTerm(word: string): string | null {
	const lower = word.toLowerCase();
	return stopWords.has(lower) ? null : stemmer(lower);
}

/**
 * The index also keeps each word unstemmed, so a word typed past its stem
 * (`serializ` of `serialization`, stemmed `serial`) still matches its start.
 */
function processIndexedTerm(word: string): ReadonlyArray<string> {
	const stem = processTerm(word);
	const lower = word.toLowerCase();
	if (stem === null) {
		return [];
	}
	return stem === lower ? [stem] : [stem, lower];
}

function termsOf(text: string): ReadonlyArray<string> {
	return words(text).flatMap((word) => processTerm(word) ?? []);
}

/** At most one typo in a short word and two in a long one; none under 4 letters. */
function maxTypos(term: string) {
	if (term.length < 4) {
		return 0;
	}
	return term.length < 6 ? 1 : 2;
}

const indexOptions: Options<SearchDocument> = {
	fields: ["title", "page", "description", "body"],
	processTerm: (word) => [...processIndexedTerm(word)],
	searchOptions: {
		boost: { body: 1, description: 2, page: 0.5, title: 6 },
		boostDocument: (id: string) => (id.includes("#") ? 1 : 1.5),
		fuzzy: (term) => maxTypos(term) || false,
		prefix: (term) => term.length >= 3,
		processTerm,
		tokenize: (text) => [...words(text)],
	},
	storeFields: ["context", "hash", "slug", "title"],
	// Identifiers are indexed whole and by part, so `error` finds
	// `RpcClientError` and `useAtomResult` finds itself.
	tokenize: (text) =>
		words(text).flatMap((word) => [word, ...identifierParts(word)]),
};

/** The index of every page and heading, as JSON, built at build time. */
export function buildSearchIndex(pages: ReadonlyArray<SearchPage>): string {
	const index = new MiniSearch<SearchDocument>(indexOptions);
	index.addAll(
		pages.flatMap((page) => {
			const body = (id: string | undefined) =>
				page.sections.find((section) => section.id === id)?.text ?? "";
			return [
				{
					body: body(undefined),
					context: page.section,
					description: page.description,
					hash: undefined,
					id: page.slug,
					page: "",
					slug: page.slug,
					title: page.title,
				},
				...page.headings.map((heading) => ({
					body: body(heading.id),
					context: page.title,
					description: "",
					hash: heading.id,
					id: `${page.slug}#${heading.id}`,
					page: page.title,
					slug: page.slug,
					title: heading.text,
				})),
			];
		}),
	);
	return JSON.stringify(index);
}

export type SearchIndex = MiniSearch<SearchDocument>;

export function loadSearchIndex(json: string): SearchIndex {
	return MiniSearch.loadJSON<SearchDocument>(json, indexOptions);
}

const synonymMembers = synonymGroups.map((group) =>
	group.map((phrase) => ({ phrase, terms: termsOf(phrase) })),
);

function editDistance(a: string, b: string) {
	let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
	for (let i = 1; i <= a.length; i++) {
		const current = [i];
		for (let j = 1; j <= b.length; j++) {
			current[j] = Math.min(
				(previous[j] ?? 0) + 1,
				(current[j - 1] ?? 0) + 1,
				(previous[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1),
			);
		}
		previous = current;
	}
	return previous[b.length] ?? 0;
}

/**
 * Whether a query term names a synonym: exactly, with a typo, or, for the
 * word being typed, as the start of one.
 */
function namesSynonym(term: string, member: string, typing: boolean) {
	return (
		term === member ||
		(term.length >= 5 &&
			editDistance(term, member) <= Math.min(maxTypos(term), 1)) ||
		(typing && term.length >= 4 && member.startsWith(term))
	);
}

/** One part of a query: what was typed, and what else would answer it. */
interface QueryPart {
	readonly alternatives: ReadonlyArray<string>;
	readonly literal: string;
}

function queryParts(query: string): ReadonlyArray<QueryPart> {
	const tokens = words(query).flatMap((word) => {
		const term = processTerm(word);
		return term ? [{ term, word }] : [];
	});
	const parts: Array<QueryPart> = [];
	let index = 0;
	while (index < tokens.length) {
		const rest = tokens.slice(index).map((token) => token.term);
		// The longest synonym phrase the query starts with here, such as
		// "server rendering".
		const phrase = synonymMembers
			.flatMap((group) =>
				group.flatMap((member) =>
					member.terms.length > 1 &&
					member.terms.every((term, offset) => rest[offset] === term)
						? [{ group, member }]
						: [],
				),
			)
			.toSorted((a, b) => b.member.terms.length - a.member.terms.length)[0];
		const length = phrase?.member.terms.length ?? 1;
		const taken = tokens.slice(index, index + length);
		const literal = taken.map((token) => token.word).join(" ");
		const literalTerms = taken.map((token) => token.term).join(" ");
		const typing = index + length === tokens.length;
		const groups = phrase
			? synonymMembers.filter((group) => group.includes(phrase.member))
			: synonymMembers.filter((group) =>
					group.some(
						(member) =>
							member.terms.length === 1 &&
							namesSynonym(rest[0] ?? "", member.terms[0] ?? "", typing),
					),
				);
		const alternatives = new Set(
			groups.flatMap((group) =>
				group.flatMap((member) =>
					member.terms.join(" ") === literalTerms ? [] : [member.phrase],
				),
			),
		);
		const identifier = taken.length === 1 ? identifierParts(literal) : [];
		if (identifier.length > 0) {
			alternatives.add(identifier.join(" "));
		}
		parts.push({ alternatives: [...alternatives], literal });
		index += length;
	}
	return parts;
}

/** A synonym counts for less than the word typed. */
const synonymBoost = 0.4;

/**
 * How well each hit answers one part of the query: its best match among the
 * word typed and its synonyms. Taking the best rather than the sum keeps a
 * page that uses many synonyms from outranking one that uses the word. A
 * synonym's scores are scaled so its best hit scores no higher than the
 * word's: a rare API name scores high wherever it appears.
 */
function partScores(index: SearchIndex, part: QueryPart) {
	const scores = new Map<string, { result: SearchResult; score: number }>();
	const add = (results: ReadonlyArray<SearchResult>, weight: number) => {
		for (const result of results) {
			const id = String(result.id);
			const score = result.score * weight;
			if (score > (scores.get(id)?.score ?? 0)) {
				scores.set(id, { result, score });
			}
		}
	};
	const exact = { combineWith: "AND", fuzzy: false, prefix: false } as const;
	const literal = index.search(part.literal, { combineWith: "AND" });
	const literalTop = literal[0]?.score;
	add(literal, 1);
	for (const swapped of transpositions(part.literal)) {
		add(index.search(swapped, exact), transpositionWeight);
	}
	for (const alternative of part.alternatives) {
		const results = index.search(alternative, exact);
		const top = results[0]?.score ?? 0;
		const scale =
			literalTop === undefined || top <= literalTop ? 1 : literalTop / top;
		// A phrase's score is the sum of its words'.
		const length = Math.max(termsOf(alternative).length, 1);
		add(results, (synonymBoost * scale) / length);
	}
	return scores;
}

/** Fuzzy search's weight for one typo. */
const transpositionWeight = 0.45;

/**
 * The word with each pair of neighbouring letters swapped. Fuzzy search
 * counts a swap as two typos, too many for `erorr` to find `error`.
 */
function transpositions(word: string): ReadonlyArray<string> {
	if (word.length < 4 || /\s/.test(word)) {
		return [];
	}
	const lower = word.toLowerCase();
	const swapped = new Set<string>();
	for (let index = 0; index < lower.length - 1; index++) {
		const variant = `${lower.slice(0, index)}${lower[index + 1] ?? ""}${lower[index] ?? ""}${lower.slice(index + 2)}`;
		if (variant !== lower) {
			swapped.add(variant);
		}
	}
	return [...swapped];
}

/** The fields the index stores with each hit (`storeFields`). */
const StoredFields = Schema.Struct({
	context: Schema.String,
	hash: Schema.optional(Schema.String),
	slug: Schema.String,
	title: Schema.String,
});

const decodeStoredFields = Schema.decodeUnknownSync(StoredFields);

function toHit(result: SearchResult): SearchHit {
	const fields = decodeStoredFields(result);
	return {
		context: fields.context,
		hash: fields.hash,
		id: String(result.id),
		slug: fields.slug,
		title: fields.title,
	};
}

/**
 * Pages and headings for `query`, best first. Every part of it must match, by
 * its stem, a typo, its start, or a synonym; when no hit matches them all,
 * hits that match any are ranked by their sum.
 */
export function searchDocs(
	index: SearchIndex,
	query: string,
	limit = 20,
): ReadonlyArray<SearchHit> {
	const scores = queryParts(query).map((part) => partScores(index, part));
	const combine = (every: boolean) => {
		const hits = new Map<string, { result: SearchResult; score: number }>();
		for (const [id, { result }] of scores[0] ?? []) {
			if (every && !scores.every((part) => part.has(id))) {
				continue;
			}
			hits.set(id, { result, score: 0 });
		}
		if (!every) {
			for (const part of scores) {
				for (const [id, { result }] of part) {
					hits.set(id, { result, score: 0 });
				}
			}
		}
		return [...hits].map(([id, hit]) => ({
			result: hit.result,
			score: scores.reduce((sum, part) => sum + (part.get(id)?.score ?? 0), 0),
		}));
	};
	const all = combine(true);
	const results = all.length > 0 ? all : combine(false);
	return results
		.toSorted((a, b) => b.score - a.score)
		.slice(0, limit)
		.map((hit) => toHit(hit.result));
}
