import { Effect, Schema } from "effect";

/** Which framework the home page's samples show. */
export const frameworkModes = [
	"tanstack-start",
	"nextjs",
	"react-router",
] as const;

export type FrameworkMode = (typeof frameworkModes)[number];

export const defaultFrameworkMode: FrameworkMode = "tanstack-start";

export const frameworkModeLabels = {
	nextjs: "Next.js",
	"react-router": "React Router",
	"tanstack-start": "TanStack Start",
} as const satisfies Record<FrameworkMode, string>;

/**
 * Search on `/`: `?mode=nextjs`, `?mode=react-router`, or omitted for
 * TanStack Start. An unknown mode reads as the default, like the
 * before-paint script does.
 */
export const homeSearchSchema = Schema.toStandardSchemaV1(
	Schema.Struct({
		mode: Schema.Literals(frameworkModes).pipe(
			Schema.catchDecoding(() => Effect.succeedSome(defaultFrameworkMode)),
			Schema.withDecodingDefaultKey(Effect.succeed(defaultFrameworkMode)),
		),
	}),
);

/** Stripped from the URL by `stripSearchParams` on `/`, so `/` stays clean. */
export const homeSearchDefaults = { mode: defaultFrameworkMode } as const;

/**
 * Sets `data-framework-mode`, and moves the shared step `id`s onto the
 * visible panel only: every mode ships in the static HTML. It's stringified
 * into `frameworkModeScript`, so it can't close over module bindings.
 *
 * It also marks the pill's link for `mode` the way an active `Link` is
 * marked. Hydration doesn't patch attributes, so a page prerendered with
 * the default mode would otherwise keep `aria-current` on that link.
 */
function applyFrameworkMode(mode: FrameworkMode) {
	document.documentElement.setAttribute("data-framework-mode", mode);
	for (const link of document.querySelectorAll<HTMLElement>(
		"[data-framework-mode-link]",
	)) {
		const active = link.dataset["frameworkModeLink"] === mode;
		link.classList.toggle("active", active);
		if (active) {
			link.setAttribute("aria-current", "page");
			link.setAttribute("data-status", "active");
		} else {
			link.removeAttribute("aria-current");
			link.removeAttribute("data-status");
		}
	}
	for (const panel of document.querySelectorAll("[data-framework-panel]")) {
		const visible = panel.getAttribute("data-framework-panel") === mode;
		for (const step of panel.querySelectorAll<HTMLElement>("[data-step-id]")) {
			const stepId = step.dataset["stepId"];
			if (stepId === undefined) {
				continue;
			}
			if (visible) {
				step.id = stepId;
			} else {
				step.removeAttribute("id");
			}
		}
	}
}

/**
 * Runs before first paint, so `/?mode=nextjs` never flashes the prerendered
 * TanStack Start panels. Pairs with the `[data-framework-panel]` CSS.
 */
export const frameworkModeScript = `(${applyFrameworkMode.toString()})(((m)=>${JSON.stringify(frameworkModes)}.includes(m)?m:${JSON.stringify(defaultFrameworkMode)})(new URLSearchParams(location.search).get("mode")));`;

/** Keeps `<html data-framework-mode>` in sync after client navigations. */
export function syncFrameworkModeAttribute(mode: FrameworkMode) {
	if (!import.meta.env.SSR) {
		applyFrameworkMode(mode);
	}
}
