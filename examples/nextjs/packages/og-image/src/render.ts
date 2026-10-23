/**
 * Renders social cards to PNG: satori lays a card out as SVG, resvg
 * rasterizes it. No network: the fonts come from `@fontsource`.
 */
import { renderAsync, Resvg } from "@resvg/resvg-js";
import { Data, Effect, FileSystem, Option, Path, Schema } from "effect";
import satori, { type Font } from "satori";

import {
	backdropSvg,
	type CardAssets,
	cardElement,
	type OgCard,
	ogImageSize,
} from "./card.ts";

export { OgCard } from "./card.ts";

class OgImageError extends Data.TaggedError("OgImageError")<{
	readonly cause: unknown;
	readonly path: string;
}> {
	override get message() {
		return `Couldn't render the social card for ${this.path}: ${String(this.cause)}`;
	}
}

const fontFiles = [
	["Inter", 400, "@fontsource/inter/files/inter-latin-400-normal.woff"],
	["Inter", 800, "@fontsource/inter/files/inter-latin-800-normal.woff"],
	[
		"JetBrains Mono",
		500,
		"@fontsource/jetbrains-mono/files/jetbrains-mono-latin-500-normal.woff",
	],
] as const;

const decodePackageJson = Schema.decodeUnknownEffect(
	Schema.fromJsonString(Schema.Struct({ version: Schema.String })),
);

const rasterOptions = { font: { loadSystemFonts: false } } as const;

/** Cached cards no build has read for this long are deleted. */
const maxAgeMs = 14 * 24 * 60 * 60 * 1000;

const dataUri = (type: string, bytes: Uint8Array) =>
	`data:${type};base64,${Buffer.from(bytes).toString("base64")}`;

export interface RendererOptions {
	/** Where PNGs are kept between builds, by a hash of their SVG. */
	readonly cacheDir?: string | undefined;
	/** The mark, as SVG markup. */
	readonly logoSvg: string;
}

/**
 * Loads the fonts and images once; the result renders a card as PNG.
 * Rasterizing is most of a card's time, so with a `cacheDir` a card whose
 * SVG didn't change is read back instead.
 */
export const loadOgRenderer = Effect.fn("loadOgRenderer")(function* (
	options: RendererOptions,
) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const resolve = (specifier: string) =>
		path.fromFileUrl(new URL(import.meta.resolve(specifier)));
	const resvgVersion = yield* resolve("@resvg/resvg-js/package.json").pipe(
		Effect.flatMap(fs.readFileString),
		Effect.flatMap(decodePackageJson),
		Effect.map((json) => json.version),
	);
	const fonts: Array<Font> = yield* Effect.forEach(fontFiles, (font) =>
		resolve(font[2]).pipe(
			Effect.flatMap(fs.readFile),
			Effect.map((data) => ({
				data: Buffer.from(data),
				name: font[0],
				style: "normal" as const,
				weight: font[1],
			})),
		),
	);
	const assets: CardAssets = {
		// A bitmap, so each card composites it instead of redrawing its paths.
		backdrop: dataUri(
			"image/png",
			new Resvg(backdropSvg, {
				fitTo: { mode: "width", value: ogImageSize.width },
			})
				.render()
				.asPng(),
		),
		logo: dataUri("image/svg+xml", new TextEncoder().encode(options.logoSvg)),
	};
	const cacheDir = options.cacheDir;

	return Effect.fn("renderOgImage")(function* (card: OgCard) {
		const fail = (cause: unknown) =>
			new OgImageError({ cause, path: card.path });
		const svg = yield* Effect.tryPromise({
			catch: fail,
			try: () => satori(cardElement(assets, card), { ...ogImageSize, fonts }),
		});
		// On libuv's threads, so a build's cards rasterize in parallel.
		const rasterize = Effect.tryPromise({
			catch: fail,
			try: async () => (await renderAsync(svg, rasterOptions)).asPng(),
		});
		if (cacheDir === undefined) {
			return yield* rasterize;
		}
		const key = yield* Effect.promise(() =>
			crypto.subtle.digest(
				"SHA-256",
				new TextEncoder().encode(
					JSON.stringify([resvgVersion, rasterOptions, svg]),
				),
			),
		);
		const file = path.join(cacheDir, `${Buffer.from(key).toString("hex")}.png`);
		const cached = yield* fs.readFile(file).pipe(Effect.option);
		if (Option.isSome(cached)) {
			const now = new Date();
			yield* fs.utimes(file, now, now).pipe(Effect.ignore);
			return cached.value;
		}
		const png = yield* rasterize;
		yield* fs.makeDirectory(cacheDir, { recursive: true }).pipe(
			Effect.andThen(fs.writeFile(file, png)),
			Effect.catch((error) =>
				Effect.logWarning(`Couldn't write the card cache: ${error.message}`),
			),
		);
		return png;
	});
});

/** Renders one card to `file`, for an app that serves a single card. */
export const writeOgImage = Effect.fn("writeOgImage")(function* (
	card: OgCard,
	file: string,
	options: RendererOptions,
) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const render = yield* loadOgRenderer(options);
	const png = yield* render(card);
	yield* fs.makeDirectory(path.dirname(file), { recursive: true });
	yield* fs.writeFile(file, png);
});

/** Deletes cached cards no build has read for two weeks. */
export const pruneCache = Effect.fn("pruneCache")(function* (cacheDir: string) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const names = yield* fs
		.readDirectory(cacheDir)
		.pipe(Effect.orElseSucceed((): Array<string> => []));
	yield* Effect.forEach(
		names,
		(name) =>
			Effect.gen(function* () {
				const file = path.join(cacheDir, name);
				const info = yield* fs.stat(file);
				const mtime = Option.getOrElse(info.mtime, () => new Date(0));
				if (Date.now() - mtime.getTime() > maxAgeMs) {
					yield* fs.remove(file);
				}
			}).pipe(Effect.ignore),
		{ concurrency: 64 },
	);
});
