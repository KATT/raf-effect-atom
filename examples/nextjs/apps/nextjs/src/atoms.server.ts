import "server-only";

import { headers } from "next/headers";
import { makeRequestAtoms } from "raf-effect-atom/next";

import { requestCookie } from "./issues.ts";

/**
 * The verbs and `dehydrate` the pages use. Each request's registry starts
 * with the page request's cookie, so the in-process RPC calls run with the
 * browser's session and latency.
 *
 * The protocol reads the cookie from an atom rather than from `headers()`
 * when it sends: Effect runs the fibers of every request from one scheduler,
 * so a request's own async context isn't guaranteed there.
 */
export const atoms = makeRequestAtoms({
	seed: async (registry) => {
		const cookie = (await headers()).get("cookie");
		registry.set(requestCookie, cookie ?? undefined);
	},
});
