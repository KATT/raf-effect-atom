/**
 * The most pixels of scroll (the code's top nearing the sticky line) over
 * which the pill drifts from the code's center to the viewport's.
 */
const parallaxTravel = 280;

export interface FrameworkModeBarLayoutInput {
	/** Viewport rect of `#hero-code`: the pill docks in its top padding. */
	readonly code: {
		readonly left: number;
		readonly top: number;
		readonly width: number;
	};
	/** Viewport bottom of the `#how-it-works` section, where the sticky range ends. */
	readonly howItWorksBottom: number;
	readonly isLarge: boolean;
	readonly pillHeight: number;
	readonly reducedMotion: boolean;
	readonly scrollY: number;
	readonly stickyTop: number;
	readonly viewportWidth: number;
}

export interface FrameworkModeBarLayout {
	/**
	 * The pill's center, in its containing block's coordinates: `#hero-code`
	 * while `absolute`, the viewport while `fixed`.
	 */
	readonly left: number;
	readonly position: "absolute" | "fixed";
	/** The pill's top edge, in the same coordinates as `left`. */
	readonly top: number;
}

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

function lerp(from: number, to: number, t: number) {
	return from + (to - from) * t;
}

/**
 * Where the home page's framework pill sits for one scroll and layout:
 *
 * - docked (`absolute`) above the hero code until that spot would scroll
 *   under the header;
 * - stuck (`fixed`) under the header while `#how-it-works` has room;
 * - then still `fixed`, with `top` following the section's bottom, so the
 *   pill scrolls away with the section.
 */
export function frameworkModeBarLayout(
	input: FrameworkModeBarLayoutInput,
): FrameworkModeBarLayout {
	const distance = input.code.top - input.stickyTop;
	const docked = distance > 0;
	// Never longer than the distance at the top of the page, so the pill
	// starts on the code's center even when the hero sits close to the header.
	const travel = Math.max(
		1,
		Math.min(parallaxTravel, distance + input.scrollY),
	);
	const progress = docked ? clamp(1 - distance / travel, 0, 1) : 1;

	const codeCenter = input.code.left + input.code.width / 2;
	const viewportCenter = input.viewportWidth / 2;
	let center = lerp(codeCenter, viewportCenter, progress);
	if (!input.isLarge) {
		center = codeCenter;
	} else if (input.reducedMotion) {
		center = docked ? codeCenter : viewportCenter;
	}

	if (docked) {
		return { left: center - input.code.left, position: "absolute", top: 0 };
	}
	return {
		left: center,
		position: "fixed",
		top: Math.min(input.stickyTop, input.howItWorksBottom - input.pillHeight),
	};
}
