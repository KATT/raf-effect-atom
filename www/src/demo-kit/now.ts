import { useSyncExternalStore } from "react";

const tickMs = 50;

function subscribeToTicks(onTick: () => void) {
	const timer = setInterval(onTick, tickMs);
	return () => {
		clearInterval(timer);
	};
}

function currentTick() {
	return Math.floor(Date.now() / tickMs) * tickMs;
}

/** The time, updated every 50 ms, for timers and the timeline. */
export function useNow() {
	return useSyncExternalStore(subscribeToTicks, currentTick, currentTick);
}

const reducedMotion = "(prefers-reduced-motion: reduce)";

function subscribeToMotion(onChange: () => void) {
	const query = matchMedia(reducedMotion);
	query.addEventListener("change", onChange);
	return () => {
		query.removeEventListener("change", onChange);
	};
}

function prefersReducedMotion() {
	return matchMedia(reducedMotion).matches;
}

function noPreference() {
	return false;
}

/** Whether the reader asked for less motion, for what CSS can't switch off. */
export function useReducedMotion() {
	return useSyncExternalStore(
		subscribeToMotion,
		prefersReducedMotion,
		noPreference,
	);
}
