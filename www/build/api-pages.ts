import { site } from "../src/site.ts";
import type {
	ApiDoc,
	ApiEntry,
	ApiExport,
	ApiGroup,
	ApiReference,
} from "./api-reference.ts";

/** The sidebar section of the API reference's pages. */
export const apiSection = "API reference";

const indexSlug = "api";

/** A generated page, with what a page's frontmatter has. */
export interface ApiPage {
	readonly description: string;
	readonly markdown: string;
	readonly order: number;
	readonly slug: string;
	/** What it's generated from, from the repository's root. */
	readonly sourcePath: string;
	readonly title: string;
}

/** `raf-effect-atom/next` → `api-raf-effect-atom-next`. */
function entrySlug(specifier: string) {
	return `${indexSlug}-${specifier.replaceAll(/[^\w]+/g, "-")}`;
}

/** A link from one page to an export's anchor on another, as pages write them. */
function href(slug: string, id: string) {
	return `./${slug}.md#${id}`;
}

/**
 * Where each API name the docs may mention is documented, by name, as a site
 * path: `useAtomResult`, `Loader.ensure`, and a namespace member by its own
 * name (`LeaseTTL`) when that doesn't collide.
 */
export type ApiLinks = ReadonlyMap<string, string>;

/**
 * Builds `ApiLinks`. A name can point at several exports: `ensure` is both
 * `raf-effect-atom/next`'s and `Loader.ensure`. A package's main entry beats
 * its subpaths, and an export by its own name beats a namespace member by
 * its short name; a name whose best match isn't unique isn't linked.
 */
export function apiLinks(reference: ApiReference): ApiLinks {
	const candidates = new Map<
		string,
		Map<string, { readonly score: number; readonly url: string }>
	>();
	const add = (name: string, api: ApiExport, url: string, score: number) => {
		const identity = `${api.source.path}:${api.source.line}`;
		const byIdentity = candidates.get(name) ?? new Map();
		candidates.set(name, byIdentity);
		const existing = byIdentity.get(identity);
		if (!existing || existing.score < score) {
			byIdentity.set(identity, { score, url });
		}
	};
	for (const entry of reference.entries) {
		const slug = entrySlug(entry.specifier);
		const main = entry.specifier === entry.packageName ? 2 : 0;
		for (const group of entry.groups) {
			if (group.namespace) {
				add(
					group.namespace.name,
					group.namespace,
					`/docs/${slug}#${group.id}`,
					main + 1,
				);
			}
			for (const api of group.exports) {
				const url = `/docs/${slug}#${api.id}`;
				add(api.name, api, url, main + 1);
				const short = api.name.split(".").at(-1);
				if (group.namespace && short) {
					add(short, api, url, main);
				}
			}
		}
	}
	const links = new Map<string, string>();
	for (const [name, byIdentity] of candidates) {
		const ranked = [...byIdentity.values()].toSorted(
			(a, b) => b.score - a.score,
		);
		const [best, next] = ranked;
		if (best && (!next || next.score < best.score)) {
			links.set(name, best.url);
		}
	}
	return links;
}

/** The first sentence of a description's first paragraph, on one line. */
function summaryOf(description: string) {
	const paragraph = (description.split(/\n\s*\n/)[0] ?? "")
		.replaceAll(/\s+/g, " ")
		.trim();
	return /^.*?[.!?](?=\s|$)/.exec(paragraph)?.[0] ?? paragraph;
}

/**
 * Turns `{@link name}` into a link: a member of the same namespace first,
 * then the same entry's exports, then any export. A name that isn't one of
 * them, such as Effect's, stays code.
 */
function resolveLinks(
	text: string,
	context: {
		readonly ids: ReadonlyMap<string, string>;
		readonly links: ApiLinks;
		readonly namespace: string | undefined;
	},
) {
	return text.replaceAll(
		/\{@link(?:code|plain)?\s+([^\s|}]+)(?:\s*\|?\s*([^}]*))?\}/g,
		(_match, name: string, label: string | undefined) => {
			const shown = label?.trim() || `\`${name}\``;
			const url =
				(context.namespace &&
					context.ids.get(`${context.namespace}.${name}`)) ||
				context.ids.get(name) ||
				context.links.get(name)?.replace(/^\/docs\/([\w-]+)#/, "./$1.md#");
			return url ? `[${shown}](${url})` : shown;
		},
	);
}

function meta(api: ApiExport, doc: ApiDoc) {
	const parts = [
		`<span class="api-kind">${api.kind}</span>`,
		...(doc.category ? [`<span>${doc.category}</span>`] : []),
		...(doc.since ? [`<span>since ${doc.since}</span>`] : []),
		`<a href="${site.github}/blob/main/${api.source.path}#L${api.source.line}">Source</a>`,
	];
	return `<p class="api-meta">${parts.join("")}</p>`;
}

function fence(code: string, lang = "ts") {
	const ticks = code.includes("```") ? "````" : "```";
	return `${ticks}${lang}\n${code}\n${ticks}`;
}

function docMarkdown(doc: ApiDoc, resolve: (text: string) => string) {
	const blocks: Array<string> = [];
	if (doc.deprecated !== undefined) {
		blocks.push(
			`> [!WARNING]\n> Deprecated.${doc.deprecated ? ` ${resolve(doc.deprecated).replaceAll("\n", "\n> ")}` : ""}`,
		);
	}
	if (doc.description) {
		blocks.push(resolve(doc.description));
	}
	if (doc.params.length) {
		blocks.push(
			"**Parameters**",
			doc.params
				.map(
					(param) =>
						`- \`${param.name}\`${param.text ? `: ${resolve(param.text)}` : ""}`,
				)
				.join("\n"),
		);
	}
	if (doc.returns) {
		blocks.push(`**Returns** ${resolve(doc.returns)}`);
	}
	for (const example of doc.examples) {
		blocks.push(
			"**Example**",
			example.includes("```") ? example : fence(example),
		);
	}
	if (doc.see.length) {
		blocks.push(
			"**See also**",
			doc.see.map((see) => `- ${resolve(see)}`).join("\n"),
		);
	}
	return blocks;
}

function exportMarkdown(
	api: ApiExport,
	depth: 2 | 3,
	resolve: (text: string) => string,
) {
	return [
		`${"#".repeat(depth)} \`${api.name}\` {#${api.id}}`,
		meta(api, api.doc),
		...api.signatures.map((signature) => fence(signature)),
		...docMarkdown(api.doc, resolve),
	];
}

function groupMarkdown(
	entry: ApiEntry,
	group: ApiGroup,
	resolve: (text: string, namespace: string | undefined) => string,
) {
	const namespace = group.namespace;
	const inGroup = (text: string) => resolve(text, namespace?.name);
	if (group.inEntry) {
		return group.exports.flatMap((member) =>
			exportMarkdown(member, 2, inGroup),
		);
	}
	const head = namespace
		? [
				...exportMarkdown(namespace, 2, inGroup),
				fence(`import { ${namespace.name} } from "${entry.specifier}";`),
			]
		: [
				`## ${group.title} {#${group.id}}`,
				...(group.description ? [inGroup(group.description)] : []),
			];
	return [
		...head,
		...group.exports.flatMap((api) => exportMarkdown(api, 3, inGroup)),
	];
}

function entryPage(entry: ApiEntry, order: number, links: ApiLinks): ApiPage {
	const slug = entrySlug(entry.specifier);
	const ids = new Map(
		entry.groups.flatMap((group) => [
			...(group.namespace
				? [[group.namespace.name, href(slug, group.id)] as const]
				: []),
			...group.exports.map((api) => [api.name, href(slug, api.id)] as const),
		]),
	);
	const resolve = (text: string, namespace: string | undefined) =>
		resolveLinks(text, { ids, links, namespace });
	const values = entry.groups.flatMap((group) =>
		group.namespace
			? [group.namespace.name]
			: group.exports.flatMap((api) => (isType(api) ? [] : [api.name])),
	);
	// The page's description is the first sentence, under its title: a first
	// paragraph of only that sentence isn't repeated.
	const [first = "", ...rest] = entry.description.split(/\n\s*\n/);
	const intro = (
		first.replaceAll(/\s+/g, " ").trim() === summaryOf(entry.description)
			? rest
			: [first, ...rest]
	).map((paragraph) => resolve(paragraph, undefined));
	const blocks = [
		...intro,
		fence(
			values.length > 3
				? `import {\n${values.map((name) => `  ${name},`).join("\n")}\n} from "${entry.specifier}";`
				: `import { ${values.join(", ")} } from "${entry.specifier}";`,
		),
		...entry.groups.flatMap((group) => groupMarkdown(entry, group, resolve)),
	];
	return {
		description: summaryOf(entry.description),
		markdown: blocks.join("\n\n"),
		order,
		slug,
		sourcePath: entry.sourcePath,
		title: entry.specifier,
	};
}

function isType(api: ApiExport) {
	return api.kind === "interface" || api.kind === "type";
}

function cell(text: string) {
	return text.replaceAll("|", String.raw`\|`);
}

function indexPage(reference: ApiReference): ApiPage {
	const blocks = reference.entries.flatMap((entry) => {
		const slug = entrySlug(entry.specifier);
		const summary = summaryOf(entry.description);
		const rows = entry.groups.flatMap((group) => [
			...(group.namespace ? [group.namespace] : []),
			...group.exports,
		]);
		return [
			`## ${entry.specifier} {#${slug}}`,
			`${/[.!?]$/.test(summary) ? summary : `${summary}.`} [The full reference](./${slug}.md).`,
			[
				"| Export | Summary |",
				"| ------ | ------- |",
				...rows.map(
					(api) =>
						`| [\`${api.name}\`](${href(slug, api.id)}) | ${cell(summaryOf(api.doc.description).replaceAll(/\{@link(?:code|plain)?\s+([^\s|}]+)[^}]*\}/g, "`$1`"))} |`,
				),
			].join("\n"),
		];
	});
	return {
		description:
			"Every export of effect-atom-boundary and raf-effect-atom, with its signature and JSDoc, generated from the source.",
		markdown: blocks.join("\n\n"),
		order: 0,
		slug: indexSlug,
		sourcePath: "packages",
		title: "API reference",
	};
}

/** The API reference's pages: an index, then a page per entrypoint. */
export function apiPages(
	reference: ApiReference,
	links: ApiLinks,
): ReadonlyArray<ApiPage> {
	return [
		indexPage(reference),
		...reference.entries.map((entry, index) =>
			entryPage(entry, index + 1, links),
		),
	];
}
