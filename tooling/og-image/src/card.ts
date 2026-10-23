/**
 * The social cards' layouts, as the element trees satori lays out: the
 * raf-effect-atom mark and wordmark on the logo's near-black, with its orbit
 * drawn large behind the text in the logo's teal → violet.
 */
import { Data } from "effect";
import { type CSSProperties, createElement as h, type ReactNode } from "react";

export type OgCard = Data.TaggedEnum<{
	/** The site's landing page: its headline, and the packages it documents. */
	Home: {
		readonly headline: string;
		/** Under the headline. */
		readonly lede: string;
		/** Next to the URL, as chips. */
		readonly packages: ReadonlyArray<string>;
		/** Where the build writes the card, from the site root. */
		readonly path: string;
		readonly url: string;
	};
	/** A docs page or an app: what it is, above its title and description. */
	Page: {
		readonly description: string;
		/** Above the title, such as the page's sidebar section. */
		readonly eyebrow: string;
		readonly path: string;
		/** Top right, across from the wordmark. */
		readonly pill: string;
		readonly title: string;
		/** The page's URL, which the card shows. */
		readonly url: string;
	};
}>;
export const OgCard = Data.taggedEnum<OgCard>();

export const ogImageSize = { height: 630, width: 1200 } as const;

const colors = {
	background: "#0B0B14",
	border: "#262637",
	muted: "#A1A1B5",
	subtle: "#6E6E85",
	surface: "#141422",
	teal: "#2DD4BF",
	text: "#FAFAFA",
	violet: "#A78BFA",
} as const;

/** Images the layouts draw, as `data:` URLs. */
export interface CardAssets {
	readonly logo: string;
	readonly orbit: string;
}

/**
 * The orbit behind the text: the logo's, drawn at the card's scale. The
 * electron sits on the outer orbit, where it clears the text.
 */
export const orbitSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
	<defs>
		<linearGradient id="orbit" x1="560" y1="560" x2="1180" y2="40" gradientUnits="userSpaceOnUse">
			<stop offset="0" stop-color="${colors.teal}" />
			<stop offset="1" stop-color="${colors.violet}" />
		</linearGradient>
		<radialGradient id="electron-glow">
			<stop offset="0" stop-color="${colors.violet}" stop-opacity="0.55" />
			<stop offset="1" stop-color="${colors.violet}" stop-opacity="0" />
		</radialGradient>
	</defs>
	<g transform="rotate(-35 930 315)">
		<ellipse cx="930" cy="315" rx="400" ry="160" fill="none" stroke="url(#orbit)" stroke-width="4" />
		<ellipse cx="930" cy="315" rx="300" ry="110" fill="none" stroke="url(#orbit)" stroke-width="2" stroke-opacity="0.45" />
	</g>
	<circle cx="1128" cy="360" r="70" fill="url(#electron-glow)" />
	<circle cx="1128" cy="360" r="15" fill="${colors.violet}" stroke="${colors.background}" stroke-width="5" />
</svg>`;

/** The fonts carry Latin only: emoji would render as a missing glyph. Code spans lose their backticks. */
export const plainText = (text: string) =>
	text
		.replaceAll("`", "")
		.replaceAll(/\p{Extended_Pictographic}\uFE0F?/gu, "")
		.replaceAll(/\s+/g, " ")
		.trim();

/** `https://a.katt.dev/docs/b` as `a.katt.dev` and `/docs/b`. */
export const displayUrl = (url: string) => {
	const parsed = new URL(url);
	return {
		host: parsed.host,
		path: parsed.pathname === "/" ? "" : parsed.pathname,
	};
};

const box = (style: CSSProperties, ...children: ReadonlyArray<ReactNode>) =>
	h("div", { style: { display: "flex", ...style } }, ...children);

/** Text that wraps, cut to `lines` lines with an ellipsis. */
const paragraph = (style: CSSProperties, lines: number, text: string) =>
	h("div", { style: { display: "block", lineClamp: lines, ...style } }, text);

const fill = (style: CSSProperties) =>
	box({
		height: "100%",
		left: 0,
		position: "absolute",
		top: 0,
		width: "100%",
		...style,
	});

const backdrop = (assets: CardAssets) => [
	fill({
		backgroundImage: `radial-gradient(circle at 100% 0%, ${colors.violet}40 0%, ${colors.violet}00 50%)`,
	}),
	fill({
		backgroundImage: `radial-gradient(circle at 0% 100%, ${colors.teal}2e 0%, ${colors.teal}00 45%)`,
	}),
	h("img", {
		height: ogImageSize.height,
		src: assets.orbit,
		style: {
			left: 0,
			maskImage: "linear-gradient(to left, white 20%, transparent 70%)",
			opacity: 0.5,
			position: "absolute",
			top: 0,
		},
		width: ogImageSize.width,
	}),
	box({
		backgroundImage: `linear-gradient(to right, ${colors.teal}, ${colors.violet})`,
		bottom: 0,
		height: 6,
		left: 0,
		position: "absolute",
		width: "100%",
	}),
];

const wordmark = (assets: CardAssets, size: number) =>
	box(
		{ alignItems: "center", gap: size * 0.32 },
		h("img", { height: size, src: assets.logo, width: size }),
		box(
			{
				color: colors.text,
				fontSize: size * 0.6,
				fontWeight: 800,
				letterSpacing: "-0.02em",
			},
			"raf-effect-atom",
		),
	);

const chip = (text: string) =>
	box(
		{
			backgroundColor: `${colors.violet}1a`,
			border: `1.5px solid ${colors.violet}66`,
			borderRadius: 999,
			color: colors.violet,
			fontFamily: "JetBrains Mono",
			fontSize: 22,
			fontWeight: 500,
			padding: "8px 20px",
		},
		text,
	);

const url = (address: string, size: number) => {
	const shown = displayUrl(address);
	return box(
		{ fontFamily: "JetBrains Mono", fontSize: size, fontWeight: 500 },
		h("span", { style: { color: colors.text } }, shown.host),
		h("span", { style: { color: colors.subtle } }, shown.path),
	);
};

const frame = (assets: CardAssets, ...children: ReadonlyArray<ReactNode>) =>
	box(
		{
			backgroundColor: colors.background,
			boxSizing: "border-box",
			color: colors.text,
			flexDirection: "column",
			fontFamily: "Inter",
			height: "100%",
			padding: "60px 72px 58px",
			position: "relative",
			width: "100%",
		},
		...backdrop(assets),
		...children,
	);

const eyebrow = (text: string) =>
	box(
		{
			color: colors.teal,
			fontFamily: "JetBrains Mono",
			fontSize: 26,
			fontWeight: 500,
			marginBottom: 18,
		},
		text,
	);

const pageCard = (
	assets: CardAssets,
	page: Data.TaggedEnum.Value<OgCard, "Page">,
) => {
	const description = plainText(page.description);
	const title = plainText(page.title);
	return frame(
		assets,
		box(
			{ alignItems: "center", justifyContent: "space-between" },
			wordmark(assets, 56),
			chip(plainText(page.pill)),
		),
		box(
			{ flexDirection: "column", flexGrow: 1, justifyContent: "center" },
			eyebrow(plainText(page.eyebrow)),
			paragraph(
				{
					fontSize: title.length > 28 ? 64 : 76,
					fontWeight: 800,
					letterSpacing: "-0.035em",
					lineHeight: 1.08,
					maxWidth: 980,
				},
				2,
				title,
			),
			...(description === ""
				? []
				: [
						paragraph(
							{
								color: colors.muted,
								fontSize: 29,
								lineHeight: 1.4,
								marginTop: 22,
								maxWidth: 960,
							},
							2,
							description,
						),
					]),
		),
		box(
			{ borderTop: `1px solid ${colors.border}`, paddingTop: 24 },
			url(page.url, 24),
		),
	);
};

const homeCard = (
	assets: CardAssets,
	home: Data.TaggedEnum.Value<OgCard, "Home">,
) =>
	frame(
		assets,
		wordmark(assets, 72),
		box(
			{ flexDirection: "column", flexGrow: 1, justifyContent: "center" },
			paragraph(
				{
					fontSize: 66,
					fontWeight: 800,
					letterSpacing: "-0.035em",
					lineHeight: 1.08,
					maxWidth: 940,
				},
				3,
				plainText(home.headline),
			),
			paragraph(
				{ color: colors.muted, fontSize: 32, lineHeight: 1.4, marginTop: 22 },
				2,
				plainText(home.lede),
			),
		),
		box(
			{
				alignItems: "center",
				borderTop: `1px solid ${colors.border}`,
				justifyContent: "space-between",
				paddingTop: 24,
			},
			url(home.url, 26),
			box({ gap: 14 }, ...home.packages.map((name) => chip(name))),
		),
	);

export const cardElement = (assets: CardAssets, card: OgCard) =>
	OgCard.$match(card, {
		Home: (home) => homeCard(assets, home),
		Page: (page) => pageCard(assets, page),
	});
