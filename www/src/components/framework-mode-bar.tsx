import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { frameworkModeBarLayout } from "~/framework-mode-bar-layout.ts";
import {
	defaultFrameworkMode,
	frameworkModeLabels,
	frameworkModes,
} from "~/framework-mode.ts";

const largeQuery = "(min-width: 1024px)";
const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

interface BarStyle {
	readonly left: number | string;
	readonly position: "absolute" | "fixed";
	readonly top: number;
}

/** Docked above the code and centered on it: the prerendered position. */
const dockedStyle: BarStyle = { left: "50%", position: "absolute", top: 0 };

function sameStyle(a: BarStyle, b: BarStyle) {
	return a.left === b.left && a.position === b.position && a.top === b.top;
}

/**
 * The home page's framework pill. It docks in the room reserved above the
 * hero code (`#hero-code`), drifts toward the viewport's center as the page
 * scrolls (on large screens), sticks under the site header, and leaves with
 * the bottom of `#how-it-works`.
 *
 * Which link looks active comes from `html[data-framework-mode]` CSS, so a
 * `?mode=` link never shows the wrong one before hydration.
 */
export function FrameworkModeBar() {
	const [style, setStyle] = useState<BarStyle>(dockedStyle);

	return (
		<div
			className="pointer-events-none z-30 w-max -translate-x-1/2"
			ref={(shell) => {
				if (shell === null) {
					return;
				}
				let frame = 0;

				const measure = () => {
					const code = document.getElementById("hero-code");
					const howItWorks = document
						.getElementById("how-it-works")
						?.closest("section");
					const header = document.querySelector("header");
					if (!code || !howItWorks || !header) {
						return;
					}
					const next = frameworkModeBarLayout({
						code: code.getBoundingClientRect(),
						howItWorksBottom: howItWorks.getBoundingClientRect().bottom,
						isLarge: window.matchMedia(largeQuery).matches,
						pillHeight: shell.offsetHeight,
						reducedMotion: window.matchMedia(reducedMotionQuery).matches,
						scrollY: window.scrollY,
						// Just under the sticky site header (z-40), never over it.
						stickyTop: header.getBoundingClientRect().bottom + 8,
						viewportWidth: window.innerWidth,
					});
					setStyle((previous) => (sameStyle(previous, next) ? previous : next));
				};

				const schedule = () => {
					cancelAnimationFrame(frame);
					frame = requestAnimationFrame(measure);
				};

				measure();
				const large = window.matchMedia(largeQuery);
				const reducedMotion = window.matchMedia(reducedMotionQuery);
				window.addEventListener("scroll", schedule, { passive: true });
				window.addEventListener("resize", schedule);
				large.addEventListener("change", schedule);
				reducedMotion.addEventListener("change", schedule);
				return () => {
					cancelAnimationFrame(frame);
					window.removeEventListener("scroll", schedule);
					window.removeEventListener("resize", schedule);
					large.removeEventListener("change", schedule);
					reducedMotion.removeEventListener("change", schedule);
				};
			}}
			style={style}
		>
			<div
				aria-label="Framework for the home page's samples"
				className="pointer-events-auto flex items-center gap-0.5 rounded-full border bg-background/90 p-1 shadow-md backdrop-blur supports-[backdrop-filter]:bg-background/75"
				role="group"
			>
				{frameworkModes.map((mode) => (
					<Link
						activeOptions={{ exact: true, includeSearch: true }}
						className="framework-mode-link rounded-full px-3.5 py-1.5 text-sm text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
						data-framework-mode-link={mode}
						key={mode}
						replace
						resetScroll={false}
						search={mode === defaultFrameworkMode ? {} : { mode }}
						to="/"
					>
						{frameworkModeLabels[mode]}
					</Link>
				))}
			</div>
		</div>
	);
}
