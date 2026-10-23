import {
	decodeLatencyCookie,
	LATENCY_COOKIE,
	SESSION_COOKIE,
	SIGNED_OUT,
} from "@examples/contract";
import type { Session } from "@examples/kit/components/settings";
import { Option } from "effect";

/**
 * The settings menu's choices live in cookies, so the server renders them
 * too: the root layout reads them and the browser writes them.
 */
const PREFETCH_COOKIE = "link-prefetch";

export const prefetchOptions = [
	{ label: "Off", value: "off" },
	{ label: "On intent", value: "intent" },
	{ label: "In viewport", value: "viewport" },
] as const;
export type Prefetch = (typeof prefetchOptions)[number]["value"];

/** The backend's default when the cookie isn't set. */
const DEFAULT_LATENCY_MS = 400;

/** The settings as the cookies hold them, read by the root layout. */
export interface Settings {
	readonly latency: number;
	readonly prefetch: Prefetch;
	readonly session: Session;
}

export function parsePrefetch(value: string | undefined): Prefetch {
	return (
		prefetchOptions.find((option) => option.value === value)?.value ?? "off"
	);
}

export function parseSettings(
	cookie: (name: string) => string | undefined,
): Settings {
	return {
		latency: Option.getOrElse(
			decodeLatencyCookie(cookie(LATENCY_COOKIE)),
			() => DEFAULT_LATENCY_MS,
		),
		prefetch: parsePrefetch(cookie(PREFETCH_COOKIE)),
		session: cookie(SESSION_COOKIE) === SIGNED_OUT ? "signed-out" : "signed-in",
	};
}

function writeCookie(name: string, value: string) {
	document.cookie = `${name}=${value}; path=/; max-age=31536000; samesite=lax`;
}

function clearCookie(name: string) {
	document.cookie = `${name}=; path=/; max-age=0`;
}

export function writePrefetch(prefetch: Prefetch) {
	writeCookie(PREFETCH_COOKIE, prefetch);
}

export function writeLatency(value: string) {
	writeCookie(LATENCY_COOKIE, value);
}

/** Signing out makes every procedure fail with `Unauthorized`. */
export function writeSession(session: Session) {
	if (session === "signed-out") {
		writeCookie(SESSION_COOKIE, SIGNED_OUT);
	} else {
		clearCookie(SESSION_COOKIE);
	}
}

export function clearSettings() {
	for (const name of [PREFETCH_COOKIE, LATENCY_COOKIE, SESSION_COOKIE]) {
		clearCookie(name);
	}
}
