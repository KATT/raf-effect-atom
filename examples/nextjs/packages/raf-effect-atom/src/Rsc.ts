/**
 * Connects the loader verbs to React Server Components, such as the Next.js
 * App Router.
 *
 * Server components share one request registry per request through React's
 * `cache`: they start atoms with `prefetch`, `ensure` and `fetch`, pass the
 * handles those return to client components as props, and render them under
 * `<HydrationBoundary registry={getRegistry()}>` from `raf-effect-atom`,
 * which hydrates the registry of the root's `RegistryProvider`.
 * `makeRequestAtoms` makes the same functions over a request registry that a
 * seed prepares, such as with the request's cookie.
 *
 * @stability unstable
 * @since 0.3.0
 */
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";

import type { ArgsOf, Handle, LoadedHandle, Source } from "./Handle.ts";
import * as internal from "./internal/rsc.ts";
import type * as Loader from "./Loader.ts";
import type * as RequestRegistry from "./RequestRegistry.ts";

/**
 * The loader verbs over the request registry of the server render in
 * progress, with its registry.
 *
 * @stability unstable
 * @category models
 * @since 0.2.0
 */
export interface RequestAtoms extends Loader.Loader {
	/**
	 * The request registry of the server render in progress, for
	 * `HydrationBoundary`'s `registry`.
	 */
	readonly getRegistry: () => AtomRegistry.AtomRegistry;
}

/**
 * Creates the verbs and `getRegistry` over a request registry that `seed`
 * prepares.
 *
 * **When to use**
 *
 * Use when the request's atoms need something from the request before they
 * run, such as an RPC protocol that forwards the page request's cookie. Make
 * them once, in a server-only module, and call the verbs on them instead of
 * the ones `raf-effect-atom/rsc` exports.
 *
 * **Details**
 *
 * The seed runs on each request's registry when a server component first
 * uses it. It can be async, as `headers()` is: `ensure` and `fetch` wait
 * for it, `prefetch` returns its handle at once and starts the atom once the
 * seed resolves, and `HydrationBoundary` waits for both.
 *
 * **Example**
 *
 * ```ts
 * // src/atoms.server.ts
 * import "server-only"
 * import { headers } from "next/headers"
 * import { makeRequestAtoms } from "raf-effect-atom/rsc"
 *
 * export const atoms = makeRequestAtoms({
 *   seed: async (registry) => {
 *     registry.set(requestCookie, (await headers()).get("cookie") ?? undefined)
 *   }
 * })
 * ```
 *
 * @stability unstable
 * @category constructors
 * @since 0.2.0
 */
export const makeRequestAtoms: (
	options?: RequestRegistry.Options,
) => RequestAtoms = internal.make;

const atoms = internal.make();

/**
 * Returns the request registry of the server render in progress.
 *
 * **Details**
 *
 * Made once per request through React's `cache`, and disposed through
 * `cacheSignal` when React finishes the render, after the last streamed
 * result has been sent. The verbs take the same signal: when React aborts
 * the render, such as for a navigation the browser left, the `ensure` and
 * `fetch` calls still waiting reject with its reason.
 *
 * **Gotchas**
 *
 * Only server components share it: outside a server component render,
 * `cache` doesn't cache, so each call makes a new registry.
 *
 * @stability unstable
 * @category registry
 * @since 0.1.0
 */
export const getRegistry: () => AtomRegistry.AtomRegistry = atoms.getRegistry;

/**
 * `Loader.prefetch` on the request's registry: starts a source's atom, to
 * stream it, and returns its handle.
 *
 * @stability unstable
 * @category verbs
 * @since 0.1.0
 */
export const prefetch: <S extends Source>(
	source: S,
	...args: ArgsOf<S>
) => Handle<S> = atoms.prefetch;

/**
 * `Loader.prefetchInBrowser` on the request's registry: returns a handle
 * whose atom the browser's read starts, without starting it on the server.
 *
 * @stability unstable
 * @category verbs
 * @since 0.2.6
 */
export const prefetchInBrowser: <S extends Source>(
	source: S,
	...args: ArgsOf<S>
) => Handle<S> = atoms.prefetchInBrowser;

/**
 * `Loader.ensure` on the request's registry: starts a source's atom, waits
 * for its result, and returns its handle.
 *
 * @stability unstable
 * @category verbs
 * @since 0.1.0
 */
export const ensure: <S extends Source>(
	source: S,
	...args: ArgsOf<S>
) => Promise<LoadedHandle<S>> = atoms.ensure;

/**
 * `Loader.fetch` on the request's registry: starts or refreshes a source's
 * atom, waits for the new result, and returns its handle.
 *
 * @stability unstable
 * @category verbs
 * @since 0.1.0
 */
export const fetch: <S extends Source>(
	source: S,
	...args: ArgsOf<S>
) => Promise<LoadedHandle<S>> = atoms.fetch;

/**
 * `Loader.Loader`'s `run` on the request's registry: runs an Effect that
 * needs the registry, such as the Effect verbs in an `Effect.gen`.
 *
 * **Example**
 *
 * ```ts
 * const handles = await run(
 *   Effect.gen(function* () {
 *     const issueHandle = yield* Loader.ensure(issue, id)
 *     return { comments: yield* Loader.prefetch(commentPage, id, 0), issue: issueHandle }
 *   })
 * )
 * ```
 *
 * @stability unstable
 * @category verbs
 * @since 0.2.3
 */
export const run: Loader.Loader["run"] = atoms.run;
