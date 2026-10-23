import {
	decodeLatencyCookie,
	LATENCY_COOKIE,
	SESSION_COOKIE,
	SIGNED_OUT,
} from "@examples/contract";
import type { Session } from "@examples/kit/components/settings";
import type { AnyRouter } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getCookies, getRequestHeader } from "@tanstack/react-start/server";
import { Option } from "effect";

/** The settings menu's choices live in cookies, so the server renders them too. */
const PREFETCH_COOKIE = "link-prefetch";

export const prefetchOptions = [
	{ label: "Off", value: "off" },
	{ label: "On intent", value: "intent" },
	{ label: "In viewport", value: "viewport" },
	{ label: "On render", value: "render" },
] as const;
export type Prefetch = (typeof prefetchOptions)[number]["value"];

/** The backend's default when the cookie isn't set. */
const DEFAULT_LATENCY_MS = 400;

/** The request's cookies on the server, the document's in the browser. */
const readCookies = createIsomorphicFn()
	.server((): Record<string, string | undefined> => getCookies())
	.client((): Record<string, string | undefined> =>
		Object.fromEntries(
			document.cookie
				.split("; ")
				.filter(Boolean)
				.map((cookie) => cookie.split("=", 2)),
		),
	);

/** The page request's `cookie` header on the server; the browser sends its own. */
export const readRequestCookie = createIsomorphicFn()
	.server(() => getRequestHeader("cookie"))
	.client(() => undefined);

function writeCookie(name: string, value: string) {
	document.cookie = `${name}=${value}; path=/; max-age=31536000; samesite=lax`;
}

function clearCookie(name: string) {
	document.cookie = `${name}=; path=/; max-age=0`;
}

export function parsePrefetch(value: string | undefined): Prefetch {
	return (
		prefetchOptions.find((option) => option.value === value)?.value ?? "off"
	);
}

export function readPrefetch() {
	return parsePrefetch(readCookies()[PREFETCH_COOKIE]);
}

export function writePrefetch(prefetch: Prefetch) {
	writeCookie(PREFETCH_COOKIE, prefetch);
}

export function readLatency() {
	return Option.getOrElse(
		decodeLatencyCookie(readCookies()[LATENCY_COOKIE]),
		() => DEFAULT_LATENCY_MS,
	);
}

export function writeLatency(value: string) {
	writeCookie(LATENCY_COOKIE, value);
}

export function readSession(): Session {
	return readCookies()[SESSION_COOKIE] === SIGNED_OUT
		? "signed-out"
		: "signed-in";
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

/** `Link` reads it while rendering, so links pick it up when they next render. */
export function toDefaultPreload(
	prefetch: Prefetch,
): AnyRouter["options"]["defaultPreload"] {
	return prefetch === "off" ? false : prefetch;
}
