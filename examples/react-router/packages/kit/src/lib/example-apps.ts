/**
 * The deployed example apps: each page's title and social card meta, and
 * the card `bin/og-image.ts` renders to the app's `public/og.png` before its
 * build.
 */
export const exampleApps = {
	nextjs: {
		framework: "Next.js",
		pitch:
			"Atoms started in server components, streamed into client components, and their typed failures caught by tag.",
		url: "https://nextjs.raf-effect-atom.katt.dev",
	},
	"react-router": {
		framework: "React Router",
		pitch:
			"Atoms started from server loaders, streamed into the browser, and their typed failures caught by tag.",
		url: "https://react-router.raf-effect-atom.katt.dev",
	},
	"tanstack-start": {
		framework: "TanStack Start",
		pitch:
			"Atoms started from route loaders, streamed into the browser, and their typed failures caught by tag.",
		url: "https://tanstack-start.raf-effect-atom.katt.dev",
	},
} as const;

export type ExampleApp = (typeof exampleApps)[keyof typeof exampleApps];

export const exampleAppTitle = (app: ExampleApp) =>
	`Issues · raf-effect-atom on ${app.framework}`;

export const exampleAppDescription = (app: ExampleApp) =>
	`The raf-effect-atom issue tracker on ${app.framework}. ${app.pitch}`;

/** Where the app serves its card, as an absolute URL. */
const ogImageUrl = (app: ExampleApp) => `${app.url}/og.png`;

/**
 * The page's `<title>`, description and Open Graph / Twitter card tags, in
 * the shape TanStack Router's `head().meta` and React Router's `meta` take.
 */
export const exampleAppMeta = (app: ExampleApp) => {
	const title = exampleAppTitle(app);
	const description = exampleAppDescription(app);
	const image = ogImageUrl(app);
	return [
		{ title },
		{ content: description, name: "description" },
		{ content: title, property: "og:title" },
		{ content: description, property: "og:description" },
		{ content: app.url, property: "og:url" },
		{ content: "website", property: "og:type" },
		{ content: "raf-effect-atom", property: "og:site_name" },
		{ content: image, property: "og:image" },
		{ content: "image/png", property: "og:image:type" },
		{ content: "1200", property: "og:image:width" },
		{ content: "630", property: "og:image:height" },
		{ content: title, property: "og:image:alt" },
		{ content: "summary_large_image", name: "twitter:card" },
		{ content: title, name: "twitter:title" },
		{ content: description, name: "twitter:description" },
		{ content: image, name: "twitter:image" },
		{ content: title, name: "twitter:image:alt" },
	];
};
