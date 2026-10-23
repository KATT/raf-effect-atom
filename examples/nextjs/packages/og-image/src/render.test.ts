import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";

import { displayUrl, plainText } from "./card.ts";
import { loadOgRenderer, OgCard } from "./render.ts";

/** A PNG's width and height, from its `IHDR` chunk. */
const pngSize = (png: Uint8Array) => {
	const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
	return { height: view.getUint32(20), width: view.getUint32(16) };
};

const logoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32"><rect width="32" height="32" rx="8" fill="#0B0B14" /></svg>`;

describe("plainText", () => {
	it("drops emoji, which the fonts lack, and the backticks around code", () => {
		expect(plainText("Loader verbs ⭐️")).toBe("Loader verbs");
		expect(plainText("Catch `IssueNotFound` by tag")).toBe(
			"Catch IssueNotFound by tag",
		);
	});
});

describe("displayUrl", () => {
	it("splits the host from the path", () => {
		expect(
			displayUrl("https://raf-effect-atom.katt.dev/docs/overview"),
		).toEqual({
			host: "raf-effect-atom.katt.dev",
			path: "/docs/overview",
		});
		expect(displayUrl("https://raf-effect-atom.katt.dev")).toEqual({
			host: "raf-effect-atom.katt.dev",
			path: "",
		});
	});
});

describe("loadOgRenderer", () => {
	it.effect("renders each kind of card as a 1200×630 PNG", () =>
		Effect.gen(function* () {
			const render = yield* loadOgRenderer({ logoSvg });
			const cards = [
				OgCard.Home({
					headline: "Render-as-you-fetch and typed error boundaries",
					lede: "Start atoms from route loaders.",
					packages: ["raf-effect-atom", "effect-atom-boundary"],
					path: "/og/index.png",
					url: "https://raf-effect-atom.katt.dev",
				}),
				OgCard.Page({
					description:
						"prefetch, ensure and fetch start atoms from route loaders.",
					eyebrow: "raf-effect-atom",
					path: "/og/docs/loader-verbs.png",
					pill: "Docs",
					title: "Loader verbs",
					url: "https://raf-effect-atom.katt.dev/docs/loader-verbs",
				}),
			];
			for (const card of cards) {
				const png = yield* render(card);
				expect(pngSize(png)).toEqual({ height: 630, width: 1200 });
			}
		}).pipe(Effect.provide(NodeServices.layer)),
	);
});
