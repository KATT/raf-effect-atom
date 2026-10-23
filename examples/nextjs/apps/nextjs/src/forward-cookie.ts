import "server-only";

import { headers } from "next/headers";
import { getRegistry } from "raf-effect-atom/next";

import { requestCookie } from "./issues.ts";

/**
 * Hands the page request's cookie to this request's registry, so the
 * in-process RPC calls run with the browser's session and latency. Every page
 * calls it before its verbs.
 *
 * The protocol reads it from an atom rather than from `headers()` when it
 * sends: Effect runs the fibers of every request from one scheduler, so a
 * request's own async context isn't guaranteed there.
 */
export async function forwardCookie() {
	const cookie = (await headers()).get("cookie");
	getRegistry().set(requestCookie, cookie ?? undefined);
}
