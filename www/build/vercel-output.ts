/**
 * Writes the build as Vercel Build Output (https://vercel.com/docs/build-output-api/v3)
 * in `.vercel/output`, which Vercel deploys as is. `vercel.json` can't do
 * content negotiation: its rewrites run only when no file matches the URL,
 * and every page is a file. Routes here run before the files, so a page's URL
 * answers `Accept: text/markdown` with the page's markdown.
 */
import { Effect, FileSystem, Path } from "effect";

const contentTypes = new Map([
	[".html", "text/html; charset=utf-8"],
	[".md", "text/markdown; charset=utf-8"],
	[".txt", "text/plain; charset=utf-8"],
]);

const extension = (file: string) => {
	const dot = file.lastIndexOf(".");
	return dot > file.lastIndexOf("/") ? file.slice(dot) : "";
};

/**
 * Prerendering writes `/docs/overview` as `docs/overview/index.html`; serve
 * it at `/docs/overview`, without a trailing slash. Markdown and text files
 * get a `charset`, so non-ASCII characters survive.
 */
const overrides = (files: ReadonlyArray<string>) =>
	Object.fromEntries(
		files.flatMap((file) => {
			const contentType = contentTypes.get(extension(file));
			if (!contentType || file === "index.html" || file === "404.html") {
				return [];
			}
			return file.endsWith("/index.html")
				? [[file, { contentType, path: file.slice(0, -"/index.html".length) }]]
				: [[file, { contentType }]];
		}),
	);

const acceptsMarkdown = [
	{ key: "accept", type: "header", value: "(.*)text/markdown(.*)" },
];

/** `files` are the static files' paths, relative and `/`-separated. */
const vercelConfig = (options: {
	readonly files: ReadonlyArray<string>;
	readonly firstDoc: string;
	readonly siteUrl: string;
}) => ({
	overrides: overrides(options.files),
	routes: [
		{ headers: { Location: "/$1" }, src: "^/(.+)/$", status: 308 },
		{
			headers: { Location: "/$1" },
			src: String.raw`^/(.+)\.html$`,
			status: 308,
		},
		{
			headers: { Location: `/docs/${options.firstDoc}` },
			src: "^/docs$",
			status: 307,
		},
		{
			continue: true,
			headers: { "Cache-Control": "public, max-age=31536000, immutable" },
			src: "^/assets/.*$",
		},
		{
			continue: true,
			headers: {
				"Cache-Control":
					"public, max-age=0, s-maxage=86400, stale-while-revalidate=604800",
			},
			src: "^/(?!assets/).*$",
		},
		{
			continue: true,
			headers: {
				"Referrer-Policy": "strict-origin-when-cross-origin",
				"X-Content-Type-Options": "nosniff",
			},
			src: "^/.*$",
		},
		{
			continue: true,
			headers: {
				Link: '</llms.txt>; rel="alternate"; type="text/markdown"',
				Vary: "Accept",
			},
			src: "^/$",
		},
		{
			continue: true,
			headers: {
				Link: '</docs/$1.md>; rel="alternate"; type="text/markdown"',
				Vary: "Accept",
			},
			src: String.raw`^/docs/([\w-]+)$`,
		},
		{
			continue: true,
			headers: { Link: `<${options.siteUrl}/docs/$1>; rel="canonical"` },
			src: String.raw`^/docs/([\w-]+)\.md$`,
		},
		{ dest: "/index.md", has: acceptsMarkdown, src: "^/$" },
		{
			dest: "/docs/$1.md",
			has: acceptsMarkdown,
			src: String.raw`^/docs/([\w-]+)$`,
		},
		{ handle: "filesystem" },
		{ handle: "error" },
		{ dest: "/404.md", has: acceptsMarkdown, src: "^/.*$", status: 404 },
		{ dest: "/404.html", src: "^/.*$", status: 404 },
	],
	version: 3,
});

/** Copies `<root>/dist/client` into `<root>/.vercel/output` with its config. */
export const writeVercelOutput = Effect.fn("writeVercelOutput")(function* (
	root: string,
	options: { readonly firstDoc: string; readonly siteUrl: string },
) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const output = path.join(root, ".vercel/output");
	const staticDir = path.join(output, "static");

	yield* fs.remove(output, { force: true, recursive: true });
	yield* fs.makeDirectory(output, { recursive: true });
	yield* fs.copy(path.join(root, "dist/client"), staticDir);

	const files = yield* fs.readDirectory(staticDir, { recursive: true });
	const config = vercelConfig({
		...options,
		files: files.map((file) => file.split(path.sep).join("/")),
	});
	yield* fs.writeFileString(
		path.join(output, "config.json"),
		`${JSON.stringify(config, null, "\t")}\n`,
	);
});
