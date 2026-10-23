import { NodeServices } from "@effect/platform-node";
import { Effect } from "effect";
import type { Plugin } from "vite";

import type { OgCard } from "./card.ts";
import { loadOgRenderer, pruneCache, type RendererOptions } from "./render.ts";

/**
 * Writes each card to the client build at its `path`, which the page's
 * `og:image` points at. The dev server renders a card when it's asked for.
 */
export function ogImages(
	options: RendererOptions & { readonly cards: ReadonlyArray<OgCard> },
): Plugin {
	const byPath = new Map(options.cards.map((card) => [card.path, card]));
	let renderer: ReturnType<typeof loadRenderer> | undefined;
	const loadRenderer = () =>
		Effect.runPromise(
			Effect.provide(loadOgRenderer(options), NodeServices.layer),
		);
	const render = async (card: OgCard) => {
		renderer ??= loadRenderer();
		return Effect.runPromise((await renderer)(card));
	};

	return {
		configureServer(server) {
			server.middlewares.use((request, response, next) => {
				const card = byPath.get(
					new URL(request.url ?? "/", "http://localhost").pathname,
				);
				if (!card) {
					next();
					return;
				}
				render(card).then((png) => {
					response.setHeader("Content-Type", "image/png");
					response.setHeader("Cache-Control", "no-cache");
					response.end(png);
				}, next);
			});
		},
		async generateBundle() {
			if (this.environment.name !== "client") {
				return;
			}
			const started = performance.now();
			const pngs = await Effect.runPromise(
				Effect.forEach(
					byPath,
					([path, card]) =>
						Effect.map(
							Effect.promise(() => render(card)),
							(png) => [path, png] as const,
						),
					// resvg's `renderAsync` runs on libuv's thread pool, which bounds it.
					{ concurrency: "unbounded" },
				),
			);
			for (const [path, png] of pngs) {
				this.emitFile({ fileName: path.slice(1), source: png, type: "asset" });
			}
			if (options.cacheDir !== undefined) {
				await Effect.runPromise(
					Effect.provide(pruneCache(options.cacheDir), NodeServices.layer),
				);
			}
			this.environment.logger.info(
				`og: ${byPath.size} social cards in ${Math.round(performance.now() - started)}ms`,
			);
		},
		name: "og-images",
	};
}
