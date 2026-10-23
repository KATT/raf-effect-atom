import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem, Path, Schema } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import type { Connect, Plugin } from "vite";
import { removeTwoslashNotations } from "twoslash/fallback";
import { parse as parseYaml } from "yaml";

import type { Doc, DocMeta, DocSection, Sample } from "../src/content/types.ts";
import { buildSearchIndex, type SearchPage } from "../src/search/docs-index.ts";
import { site } from "../src/site.ts";
import { apiLinks, apiPages, apiSection, type ApiLinks } from "./api-pages.ts";
import { readApiReference } from "./api-reference.ts";
import { stripCollapseMarkers } from "./collapse.ts";
import { ContentError, messageOf } from "./content-error.ts";
import { generateRouteTrees, generateRouteTypes } from "./sample-apps.ts";
import { renderMarkdown } from "./markdown.ts";
import { expandSnippets } from "./snippets.ts";
import {
	makeTwoslashCache,
	type TwoslashCacheOptions,
} from "./twoslash-cache.ts";

export interface ContentDirs {
	/** Directory of the `.md` pages, as an absolute path. */
	readonly contentDir: string;
	/** Directory of the packages the API reference documents. */
	readonly packagesDir: string;
	/** The repository's root, for the API reference's source links. */
	readonly repoRoot: string;
	/** Directory of the sample apps the pages' code blocks compile in. */
	readonly samplesDir: string;
}

export interface ContentOptions extends ContentDirs {
	/**
	 * Slug of the page whose body `llms.txt` and `/index.md` include after the
	 * intro, for agents that read nothing else. Its headings become bold
	 * lines there: llms.txt keeps `##` headings for the page lists.
	 */
	readonly agentRules: string;
	/** Directory with one `<id>.tsx` per demo. */
	readonly demosDir: string;
	/** Where `demosDir` is browsable, for the markdown pages' demo links. */
	readonly demosUrl: string;
	/** Sidebar sections, in order. Every page's `section` must be one of them. */
	readonly sections: ReadonlyArray<string>;
	/** Absolute site URL, for `llms.txt` and the markdown pages. */
	readonly siteUrl: string;
	/** Keeps compiled code blocks on disk, so the next build reuses them. */
	readonly twoslashCache?: TwoslashCacheOptions | undefined;
}

/** The `Accept` header agents send to get markdown instead of HTML. */
const acceptsMarkdown = /\btext\/markdown\b/;

const Frontmatter = Schema.Struct({
	description: Schema.String,
	order: Schema.Number,
	section: Schema.String,
	title: Schema.String,
});

type Frontmatter = typeof Frontmatter.Type;

const decodeFrontmatter = Schema.decodeUnknownEffect(Frontmatter);

interface Source {
	/** The page's file, or `api:<slug>` for a page of the API reference. */
	readonly file: string;
	readonly frontmatter: Frontmatter;
	/** For the API reference: what the page is generated from, from the repository's root. */
	readonly generatedFrom?: string | undefined;
	/** The path whose last commit is the page's last change. */
	readonly history: string;
	/** With `sample` fences expanded into `twoslash` blocks. */
	readonly markdown: string;
	readonly slug: string;
	/** The files the page includes. */
	readonly snippets: ReadonlyArray<string>;
}

/** Replaces each `// ^?` in a Twoslash block with the type it shows, as a comment. */
function withTypes(code: string, types: ReadonlyArray<string>) {
	let index = 0;
	return code.replaceAll(/^([ \t]*)\/\/\s*\^\?[ \t]*$/gm, (marker, indent) => {
		const type = types[index] ?? "";
		index++;
		return type
			.split("\n")
			.map((line) => `${indent}// ${line}`)
			.join("\n");
	});
}

const manifestId = "virtual:docs-manifest";
const resolvedManifestId = `\0${manifestId}`;
/** The search index, a separate chunk the search dialog loads when it opens. */
const searchId = "virtual:docs-search";
const resolvedSearchId = `\0${searchId}`;
/**
 * The API reference's pages, which have no file: `virtual:docs-api` maps
 * each slug to an import of `virtual:docs-api/<slug>`, its own chunk.
 */
const apiId = "virtual:docs-api";
const resolvedApiId = `\0${apiId}`;

/**
 * `import hero from "sample:<app>/<path>#region"` renders that region of a
 * sample app's file, as a `sample` fence does, for code outside the pages.
 */
const samplePrefix = "sample:";
const resolvedSamplePrefix = `\0${samplePrefix}`;
/**
 * The region goes in the resolved id as a query: the dev server serves the
 * module at a URL made from the id, where a `#region` is a fragment the
 * browser never sends, so the client would get the whole file's sample.
 */
const regionQuery = "?region=";

const parseSource = Effect.fn("parseSource")(function* (
	dirs: ContentDirs,
	file: string,
	raw: string,
) {
	const path = yield* Path.Path;
	const match = /^---\n([\s\S]*?)\n---\n/.exec(raw);
	if (!match?.[1]) {
		return yield* new ContentError({ message: `${file}: missing frontmatter` });
	}
	const yaml = match[1];
	const frontmatter = yield* Effect.try(() => parseYaml(yaml)).pipe(
		Effect.flatMap(decodeFrontmatter),
		Effect.mapError(
			(cause) =>
				new ContentError({
					cause,
					message: `${file}: invalid frontmatter: ${messageOf(cause)}`,
				}),
		),
	);
	const expanded = yield* expandSnippets(raw.slice(match[0].length), {
		file,
		samplesDir: dirs.samplesDir,
	});
	return {
		file,
		frontmatter,
		history: file,
		markdown: expanded.markdown,
		slug: path.basename(file, ".md"),
		snippets: expanded.files,
	} satisfies Source;
});

/** When `file` last changed in git, if it's committed. */
const lastModified = Effect.fn("lastModified")(
	function* (file: string) {
		const path = yield* Path.Path;
		const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
		const date = yield* spawner.string(
			ChildProcess.make("git", ["log", "-1", "--format=%cI", "--", file], {
				cwd: path.dirname(file),
				stderr: "ignore",
			}),
		);
		return date.trim() || undefined;
	},
	Effect.orElseSucceed(() => undefined),
);

const readSources = Effect.fn("readSources")(function* (dirs: ContentDirs) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const names = yield* fs.readDirectory(dirs.contentDir);
	return yield* Effect.forEach(
		names.filter((name) => name.endsWith(".md")),
		(name) => {
			const file = path.join(dirs.contentDir, name);
			return Effect.flatMap(fs.readFileString(file), (raw) =>
				parseSource(dirs, file, raw),
			);
		},
		{ concurrency: "unbounded" },
	);
});

/**
 * The API reference's pages, generated from the packages, and the links the
 * other pages' API names get.
 */
const readApiSources = Effect.fn("readApiSources")(function* (
	dirs: ContentDirs,
) {
	const path = yield* Path.Path;
	const reference = yield* readApiReference(dirs);
	if (reference.undocumented.length) {
		yield* Effect.logWarning(
			`API reference: exports with no JSDoc: ${reference.undocumented.join(", ")}`,
		);
	}
	const links = apiLinks(reference);
	const sources = apiPages(reference, links).map((page): Source => ({
		file: `api:${page.slug}`,
		frontmatter: {
			description: page.description,
			order: page.order,
			section: apiSection,
			title: page.title,
		},
		generatedFrom: page.sourcePath,
		history: path.join(
			dirs.repoRoot,
			page.sourcePath.endsWith(".ts") || page.sourcePath.endsWith(".tsx")
				? path.dirname(page.sourcePath)
				: page.sourcePath,
		),
		markdown: page.markdown,
		slug: page.slug,
		snippets: [],
	}));
	return { links, sources };
});

/** Pages for prerendering, the sitemap and the social cards. */
export const docPages = Effect.fn("docPages")(function* (dirs: ContentDirs) {
	const api = yield* readApiSources(dirs);
	return yield* Effect.forEach(
		[...(yield* readSources(dirs)), ...api.sources],
		(source) =>
			Effect.map(lastModified(source.history), (date) => ({
				description: source.frontmatter.description,
				lastModified: date,
				path: `/docs/${source.slug}`,
				section: source.frontmatter.section,
				title: source.frontmatter.title,
			})),
		{ concurrency: "unbounded" },
	);
});

/**
 * Fails on two headings with one id, and on a link to a page or a heading
 * that doesn't exist, such as an anchor of an export the API reference no
 * longer has.
 */
function checkLinks(docs: ReadonlyArray<Doc>) {
	const anchors = new Map(
		docs.map((doc) => [
			doc.slug,
			new Set(doc.headings.map((heading) => heading.id)),
		]),
	);
	const duplicates = docs.flatMap((doc) => {
		const ids = doc.headings.map((heading) => heading.id);
		return ids
			.filter((id, index) => ids.indexOf(id) !== index)
			.map((id) => `${doc.slug}: two headings with the id "${id}"`);
	});
	const broken = docs.flatMap((doc) =>
		doc.segments.flatMap((segment) =>
			segment.kind === "html"
				? Array.from(
						segment.html.matchAll(/href="\/docs\/([\w-]+)(?:#([^"]*))?"/g),
						([link, slug = "", hash]) => {
							const ids = anchors.get(slug);
							return ids &&
								(hash === undefined || ids.has(decodeURIComponent(hash)))
								? []
								: [`${doc.slug}: ${link}`];
						},
					).flat()
				: [],
		),
	);
	if (duplicates.length || broken.length) {
		throw new ContentError({
			message: [
				...duplicates,
				...broken.map((link) => `${link} links to no page or heading`),
			].join("\n"),
		});
	}
}

/**
 * The search weight of the API reference's pages: an export whose name holds
 * a word ranks below the guides about it, and still first for its own name.
 */
const apiWeight = 0.3;

/** Runs a build step from one of Vite's hooks. */
function run<A, E>(effect: Effect.Effect<A, E, NodeServices.NodeServices>) {
	return Effect.runPromise(Effect.provide(effect, NodeServices.layer));
}

/** A rendered page, and its prose for the search index. */
interface Rendered {
	readonly doc: Doc;
	readonly sections: SearchPage["sections"];
}

/**
 * Compiles `content/*.md` at build time. Each page imports as a module of
 * pre-highlighted HTML segments (its own chunk, so the browser loads only the
 * pages it visits), `virtual:docs-manifest` lists every page for the nav,
 * search and SEO, and `virtual:docs-search` is the search index. The client
 * build also gets `llms.txt` and each page's markdown source at
 * `/docs/<slug>.md`.
 */
export function docsContent(options: ContentOptions): Plugin {
	const { samplesDir } = options;
	const twoslashCache =
		options.twoslashCache && makeTwoslashCache(options.twoslashCache);
	const rendered = new Map<string, Promise<Rendered>>();
	let api:
		| Promise<{
				readonly links: ApiLinks;
				readonly sources: ReadonlyArray<Source>;
		  }>
		| undefined;
	const readApi = () => (api ??= run(readApiSources(options)));
	/** The pages in `contentDir`, then the API reference's. */
	async function allSources() {
		const [pages, reference] = await Promise.all([
			run(readSources(options)),
			readApi(),
		]);
		return [...pages, ...reference.sources];
	}
	/** Each page's `twoslash` types, by file, for its markdown. */
	const typeQueries = new Map<string, ReadonlyArray<ReadonlyArray<string>>>();

	const renderDoc = Effect.fn("renderDoc")(function* (
		source: Source,
		links: ApiLinks,
	) {
		const fs = yield* FileSystem.FileSystem;
		const path = yield* Path.Path;
		const result = yield* renderMarkdown(source.markdown, {
			apiLinks: links,
			apiLinksPerSection: source.generatedFrom !== undefined,
			samplesDir,
			twoslashCache,
		}).pipe(
			Effect.mapError(
				(error) =>
					new ContentError({
						cause: error,
						message: `${source.file}: ${error.message}`,
					}),
			),
		);
		for (const id of result.demos) {
			if (!(yield* fs.exists(path.join(options.demosDir, `${id}.tsx`)))) {
				return yield* new ContentError({
					message: `${source.file}: unknown demo "${id}"`,
				});
			}
		}
		typeQueries.set(source.file, result.typeQueries);
		return {
			doc: {
				demos: result.demos,
				description: source.frontmatter.description,
				generatedFrom: source.generatedFrom,
				headings: result.headings,
				lastModified: yield* lastModified(source.history),
				section: source.frontmatter.section,
				segments: result.segments,
				slug: source.slug,
				title: source.frontmatter.title,
			} satisfies Doc,
			sections: result.sections,
		} satisfies Rendered;
	});

	const renderSample = Effect.fn("renderSample")(function* (spec: string) {
		const file = `${samplePrefix}${spec}`;
		const expanded = yield* expandSnippets(`\`\`\`sample\n${spec}\n\`\`\``, {
			file,
			samplesDir,
		});
		const result = yield* renderMarkdown(expanded.markdown, {
			samplesDir,
			twoslashCache,
		}).pipe(
			Effect.mapError(
				(error) =>
					new ContentError({
						cause: error,
						message: `${file}: ${error.message}`,
					}),
			),
		);
		return {
			files: expanded.files,
			sample: { segments: result.segments } satisfies Sample,
		};
	});

	function render(source: Source): Promise<Rendered> {
		const cached = rendered.get(source.file);
		if (cached) {
			return cached;
		}
		const doc = readApi().then((reference) =>
			run(renderDoc(source, reference.links)),
		);
		rendered.set(source.file, doc);
		return doc;
	}

	/** Every page, rendered, by section in sidebar order. */
	async function renderedSections() {
		const sources = await allSources();
		for (const source of sources) {
			if (!options.sections.includes(source.frontmatter.section)) {
				throw new Error(
					`${source.file}: section "${source.frontmatter.section}" isn't one of ${options.sections.join(", ")}`,
				);
			}
		}
		const pages = await Promise.all(
			sources.map(async (source) => ({
				...(await render(source)),
				order: source.frontmatter.order,
			})),
		);
		checkLinks(pages.map((page) => page.doc));
		return options.sections.map((title) => ({
			pages: pages
				.filter((page) => page.doc.section === title)
				.toSorted((a, b) => a.order - b.order),
			title,
		}));
	}

	async function manifest(): Promise<ReadonlyArray<DocSection>> {
		return (await renderedSections()).map((section) => ({
			docs: section.pages.map((entry): DocMeta => ({
				demos: entry.doc.demos,
				description: entry.doc.description,
				generatedFrom: entry.doc.generatedFrom,
				headings: entry.doc.headings,
				lastModified: entry.doc.lastModified,
				section: entry.doc.section,
				slug: entry.doc.slug,
				title: entry.doc.title,
			})),
			title: section.title,
		}));
	}

	async function searchIndex() {
		const sections = await renderedSections();
		return buildSearchIndex(
			sections.flatMap((section) =>
				section.pages.map((page): SearchPage => ({
					description: page.doc.description,
					headings: page.doc.headings,
					section: page.doc.section,
					sections: page.sections,
					slug: page.doc.slug,
					title: page.doc.title,
					weight: page.doc.generatedFrom === undefined ? undefined : apiWeight,
				})),
			),
		);
	}

	const intro = [`# ${site.name}`, "", `> ${site.description}`, ""];

	/**
	 * A page as agents read it: links point at the other pages' markdown, each
	 * demo, which only runs in a browser, becomes a link to the page and to the
	 * demo's code, and `twoslash` blocks lose their hidden setup and markers,
	 * with each `// ^?` replaced by the type it shows on the web.
	 */
	function pageMarkdown(source: Source) {
		return [
			`# ${source.frontmatter.title}`,
			"",
			`> ${source.frontmatter.description}`,
			"",
			pageBody(source),
			"",
		].join("\n");
	}

	function pageBody(source: Source) {
		const url = `${options.siteUrl}/docs/${source.slug}`;
		const types = typeQueries.get(source.file) ?? [];
		let blockIndex = 0;
		const body = stripCollapseMarkers(source.markdown)
			.replaceAll(
				/^```(\w+)([^\n]*)\btwoslash\b([^\n]*)\n([\s\S]*?)^```$/gm,
				(fence, lang, before, after, code) => {
					const queries = types[blockIndex] ?? [];
					blockIndex++;
					return `\`\`\`${lang}${`${before.trimEnd()}${after}`.trimEnd()}\n${removeTwoslashNotations(withTypes(code, queries))}\`\`\``;
				},
			)
			.replaceAll(/^(#{1,6} .*?)\s*\{#[\w.-]+\}$/gm, "$1")
			.replaceAll(
				/\]\((?:\.\/)?([\w-]+)\.md(#[\w.-]+)?\)/g,
				(link, slug, hash) =>
					`](${options.siteUrl}/docs/${slug}.md${hash ?? ""})`,
			)
			.replaceAll(
				/^```demo\n([\w-]+)\n```$/gm,
				(block, id) =>
					`> [!NOTE]\n> The [web version of this page](${url}) has an interactive demo here. Its code: [${id}.tsx](${options.demosUrl}/${id}.tsx).`,
			);
		return body.trim();
	}

	/**
	 * `llms.txt` (https://llmstxt.org): what the library is, the rules for
	 * agents, and every page.
	 */
	function llmsTxt(sections: ReadonlyArray<DocSection>, rules: Source) {
		const lines = [
			...intro,
			`**${rules.frontmatter.title}** ([page](${options.siteUrl}/docs/${rules.slug}.md))`,
			"",
			pageBody(rules).replaceAll(/^#{1,6} +(.+)$/gm, "**$1**"),
			"",
			"Every page is also markdown: add `.md` to its URL, or request it with `Accept: text/markdown`.",
			"",
		];
		for (const section of sections) {
			lines.push(`## ${section.title}`, "");
			for (const doc of section.docs) {
				lines.push(
					`- [${doc.title}](${options.siteUrl}/docs/${doc.slug}.md): ${doc.description}`,
				);
			}
			lines.push("");
		}
		lines.push(
			"## Optional",
			"",
			`- [Full documentation](${options.siteUrl}/llms-full.txt): every page above in one file`,
			"",
		);
		return lines.join("\n");
	}

	/**
	 * Files for agents, by URL path: `llms.txt`, `llms-full.txt`, each page's
	 * markdown at `/docs/<slug>.md`, `/index.md` (the home page's markdown,
	 * the same as `llms.txt`) and `/404.md`.
	 */
	async function agentFiles() {
		const sections = await manifest();
		const sources = new Map(
			(await allSources()).map((source) => [source.slug, source]),
		);
		const pages = sections
			.flatMap((section) => section.docs)
			.flatMap((doc) => {
				const source = sources.get(doc.slug);
				return source ? [source] : [];
			});
		const rules = sources.get(options.agentRules);
		if (rules === undefined) {
			throw new Error(`agentRules: no page "${options.agentRules}"`);
		}
		const files = new Map<string, string>();
		files.set("/llms.txt", llmsTxt(sections, rules));
		files.set("/index.md", llmsTxt(sections, rules));
		files.set(
			"/404.md",
			`# Not found\n\nThere is no page at this URL. [llms.txt](${options.siteUrl}/llms.txt) lists every page.\n`,
		);
		files.set(
			"/llms-full.txt",
			[
				...intro,
				...pages.map(
					(source) =>
						`---\n\nSource: ${options.siteUrl}/docs/${source.slug}\n\n${pageMarkdown(source)}`,
				),
			].join("\n"),
		);
		for (const source of pages) {
			files.set(`/docs/${source.slug}.md`, pageMarkdown(source));
		}
		return files;
	}

	/**
	 * The dev and preview servers answer like the deployed site
	 * (`build/vercel-output.ts`): agent files at their paths, and a page's
	 * markdown at the page's own URL for `Accept: text/markdown`.
	 */
	function serveAgentFiles(server: { readonly middlewares: Connect.Server }) {
		server.middlewares.use((request, response, next) => {
			const { pathname } = new URL(request.url ?? "/", "http://localhost");
			const wantsMarkdown = acceptsMarkdown.test(request.headers.accept ?? "");
			const filePath =
				wantsMarkdown && /^\/(?:docs\/[\w-]+)?$/.test(pathname)
					? `${pathname === "/" ? "/index" : pathname}.md`
					: pathname;
			if (!/\.(?:md|txt)$/.test(filePath) || filePath === "/robots.txt") {
				next();
				return;
			}
			agentFiles().then((files) => {
				const file = files.get(filePath) ?? files.get("/404.md");
				if (file === undefined || (!wantsMarkdown && !files.has(filePath))) {
					next();
					return;
				}
				response.statusCode = files.has(filePath) ? 200 : 404;
				response.setHeader(
					"Content-Type",
					filePath.endsWith(".md")
						? "text/markdown; charset=utf-8"
						: "text/plain; charset=utf-8",
				);
				response.setHeader("Vary", "Accept");
				response.end(file);
			}, next);
		});
	}

	let generated: Promise<unknown> | undefined;

	return {
		async buildStart() {
			generated ??= run(
				Effect.all(
					[generateRouteTrees(samplesDir), generateRouteTypes(samplesDir)],
					{ concurrency: "unbounded" },
				),
			);
			await generated;
		},
		configurePreviewServer: serveAgentFiles,
		configureServer: serveAgentFiles,
		async generateBundle() {
			if (this.environment.name !== "client") {
				return;
			}
			for (const [urlPath, source] of await agentFiles()) {
				this.emitFile({ fileName: urlPath.slice(1), source, type: "asset" });
			}
			if (twoslashCache) {
				this.environment.logger.info(
					`twoslash: ${twoslashCache.stats.hits} code blocks from the cache, ${twoslashCache.stats.misses} compiled`,
				);
			}
		},
		hotUpdate(context) {
			// A package's change can change every page: the API reference and
			// the API names the other pages link.
			const apiChanged =
				context.file.startsWith(options.packagesDir) &&
				/\/src\/.*\.tsx?$|\/package\.json$/.test(context.file);
			if (
				!context.file.startsWith(options.contentDir) &&
				!context.file.startsWith(samplesDir) &&
				!apiChanged
			) {
				return undefined;
			}
			if (apiChanged) {
				api = undefined;
				rendered.clear();
			} else {
				rendered.delete(context.file);
			}
			const graph = this.environment.moduleGraph;
			const stale = [...graph.idToModuleMap].flatMap(([id, module]) =>
				id === resolvedManifestId ||
				id === resolvedSearchId ||
				(apiChanged &&
					(id.startsWith(resolvedApiId) ||
						id.startsWith(options.contentDir))) ||
				(context.file.startsWith(samplesDir) &&
					id.startsWith(resolvedSamplePrefix))
					? [module]
					: [],
			);
			for (const module of stale) {
				graph.invalidateModule(module);
			}
			return stale.length ? [...context.modules, ...stale] : undefined;
		},
		async load(id) {
			if (id.startsWith(resolvedSamplePrefix)) {
				const output = await run(
					renderSample(
						id.slice(resolvedSamplePrefix.length).replace(regionQuery, "#"),
					),
				);
				for (const file of output.files) {
					this.addWatchFile(file);
				}
				return `export default ${JSON.stringify(output.sample)};`;
			}
			if (id === resolvedSearchId) {
				return `export default ${JSON.stringify(await searchIndex())};`;
			}
			if (id === resolvedApiId) {
				const reference = await readApi();
				const imports = reference.sources.map(
					(source) =>
						`${JSON.stringify(source.slug)}: () => import(${JSON.stringify(`${apiId}/${source.slug}`)})`,
				);
				return `export const pages = {\n${imports.join(",\n")}\n};`;
			}
			if (id.startsWith(`${resolvedApiId}/`)) {
				const slug = id.slice(resolvedApiId.length + 1);
				const source = (await readApi()).sources.find(
					(candidate) => candidate.slug === slug,
				);
				if (!source) {
					throw new Error(`${id}: no API reference page "${slug}"`);
				}
				return `export default ${JSON.stringify((await render(source)).doc)};`;
			}
			if (id !== resolvedManifestId) {
				return undefined;
			}
			const sections = await manifest();
			return `export const sections = ${JSON.stringify(sections)};`;
		},
		name: "raf-effect-atom-docs:content",
		resolveId(id) {
			if (id.startsWith(samplePrefix)) {
				return `\0${id.replace("#", regionQuery)}`;
			}
			if (id === searchId) {
				return resolvedSearchId;
			}
			if (id === apiId || id.startsWith(`${apiId}/`)) {
				return `\0${id}`;
			}
			return id === manifestId ? resolvedManifestId : undefined;
		},
		// One plugin instance across client/SSR so `rendered` is shared; without
		// this each environment re-runs Twoslash for every page.
		sharedDuringBuild: true,
		async transform(code, id) {
			const file = id.split("?")[0] ?? id;
			if (!file.startsWith(options.contentDir) || !file.endsWith(".md")) {
				return undefined;
			}
			const source = await run(parseSource(options, file, code));
			for (const snippet of source.snippets) {
				this.addWatchFile(snippet);
			}
			// Drop the cache only in dev: during build, client and SSR both
			// transform the same files and must reuse the shared render.
			// (Snippet edits re-run transform with unchanged markdown.)
			if (this.environment.mode === "dev") {
				rendered.delete(file);
			}
			const page = await render(source);
			return {
				code: `export default ${JSON.stringify(page.doc)};`,
				map: null,
			};
		},
	};
}
