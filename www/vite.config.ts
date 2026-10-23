import { NodeServices } from "@effect/platform-node";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { Effect } from "effect";
import { defineConfig } from "vite";

import { logoSvg } from "@examples/kit/lib/logo";
import { OgCard } from "@tooling/og-image/render";
import { ogImages } from "@tooling/og-image/vite";

import { docPages, docsContent } from "./build/content.ts";
import { absoluteUrl, ogImagePath } from "./src/seo.ts";
import { sections, site } from "./src/site.ts";

const contentDir = new URL("content", import.meta.url).pathname;
const samplesDir = new URL("samples", import.meta.url).pathname;
const packagesDir = new URL("../packages", import.meta.url).pathname;
const repoRoot = new URL("..", import.meta.url).pathname;
const demosDir = new URL("src/demos", import.meta.url).pathname;
// Vercel keeps `node_modules` between builds, and CI caches this dir.
const twoslashCacheDir = new URL(
	"node_modules/.cache/twoslash",
	import.meta.url,
).pathname;
const lockfile = new URL("../pnpm-lock.yaml", import.meta.url).pathname;
const pages = await Effect.runPromise(
	docPages({ contentDir, packagesDir, repoRoot, samplesDir }).pipe(
		Effect.provide(NodeServices.layer),
	),
);

/** The site's HTML pages: the home page and each docs page. */
const canonicalPaths = new Set(["/", ...pages.map((page) => page.path)]);

export default defineConfig({
	plugins: [
		docsContent({
			agentRules: "coding-agents",
			contentDir,
			demosDir,
			demosUrl: `${site.github}/blob/main/www/src/demos`,
			packagesDir,
			repoRoot,
			samplesDir,
			sections,
			siteUrl: site.url,
			twoslashCache: { dir: twoslashCacheDir, inputs: [lockfile] },
		}),
		ogImages({
			cacheDir: new URL("node_modules/.cache/og", import.meta.url).pathname,
			cards: [
				OgCard.Home({
					headline: site.tagline,
					lede: "Start atoms from route loaders. Catch their failures by tag.",
					packages: ["raf-effect-atom", "effect-atom-boundary"],
					path: ogImagePath("/"),
					url: site.url,
				}),
				...pages.map((page) =>
					OgCard.Page({
						description: page.description,
						eyebrow: page.section,
						path: ogImagePath(page.path),
						pill: "Docs",
						title: page.title,
						url: absoluteUrl(page.path),
					}),
				),
			],
			logoSvg,
		}),
		tailwindcss(),
		tanstackStart({
			pages: [
				{ path: "/", sitemap: { changefreq: "weekly", priority: 1 } },
				...pages.map((page) => ({
					path: page.path,
					sitemap: {
						changefreq: "weekly" as const,
						lastmod: page.lastModified,
						priority: 0.8,
					},
				})),
				{
					path: "/404",
					prerender: { enabled: true, outputPath: "/404.html" },
					sitemap: { exclude: true },
				},
			],
			prerender: {
				crawlLinks: true,
				enabled: true,
				failOnError: true,
				filter: (page) => {
					// Start adds the routes it discovers and every crawled link to
					// `pages` before this runs, and the sitemap lists every page it
					// doesn't exclude. Only the HTML pages declared above belong in
					// it, not `/docs`, anchors, the `.md` routes or `llms.txt`.
					if (!canonicalPaths.has(page.path)) {
						page.sitemap = { exclude: true };
					}
					// `/docs` redirects to the first page. `/` renders every framework
					// mode, so its `?mode=` links aren't pages of their own.
					return (
						page.path !== "/docs" &&
						!page.path.includes("#") &&
						!page.path.includes("?")
					);
				},
			},
			sitemap: { enabled: true, host: site.url },
		}),
		react(),
		babel({ presets: [reactCompilerPreset()] }),
	],
	resolve: {
		tsconfigPaths: true,
	},
});
