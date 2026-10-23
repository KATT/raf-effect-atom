/**
 * Connects the loader verbs to the Next.js App Router.
 *
 * Server components share one request registry per request through React's
 * `cache`: they start atoms with `prefetch`, `ensure` and `fetch`, and pass
 * `dehydrate()` to `HydrateAtoms`, which hydrates the client components'
 * registry from `RegistryProvider`.
 *
 * @stability unstable
 * @since 0.1.0
 */
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type * as EffectHydration from "effect/reactivity/Hydration";

import * as internal from "./internal/next-server.ts";
import type * as Loader from "./loader.ts";

export {
	/**
	 * @since 0.1.0
	 */
	HydrateAtoms,
	/**
	 * @since 0.1.0
	 */
	RegistryProvider,
} from "./next-client.tsx";

/**
 * Returns the request registry of the server render in progress.
 *
 * **Details**
 *
 * Made once per request through React's `cache`, and disposed through
 * `cacheSignal` when React finishes the render, after the last streamed
 * result has been sent.
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
export const getRegistry: () => AtomRegistry.AtomRegistry =
	internal.getRegistry;

/**
 * `Loader.prefetch` on the request's registry: starts an atom, to stream it.
 *
 * @stability unstable
 * @category verbs
 * @since 0.1.0
 */
export const prefetch: <A, E>(
	atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
) => void = internal.prefetch;

/**
 * `Loader.ensure` on the request's registry: starts an atom and returns its
 * settled result.
 *
 * @stability unstable
 * @category verbs
 * @since 0.1.0
 */
export const ensure: <A, E>(
	atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
) => Promise<Loader.SettledResult<A, E>> = internal.ensure;

/**
 * `Loader.fetch` on the request's registry: starts or refreshes an atom and
 * returns the new settled result.
 *
 * @stability unstable
 * @category verbs
 * @since 0.1.0
 */
export const fetch: <A, E>(
	atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
) => Promise<Loader.SettledResult<A, E>> = internal.fetch;

/**
 * `Hydration.dehydrate` on the request's registry, for `HydrateAtoms`.
 *
 * **Gotchas**
 *
 * Includes the atoms started so far, so call it after the server component's
 * verbs. Each `HydrateAtoms` hydrates what its own `dehydrate()` saw.
 *
 * @stability unstable
 * @category dehydration
 * @since 0.1.0
 */
export const dehydrate: () => Array<EffectHydration.DehydratedAtom> =
	internal.dehydrate;
