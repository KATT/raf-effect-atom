/**
 * Connects the loader verbs to the Next.js App Router.
 *
 * Server components share one request registry per request through React's
 * `cache`: they start atoms with `prefetch`, `ensure` and `fetch`, pass the
 * handles those return to client components as props, and pass
 * `dehydrate()` to `HydrateAtoms`, which hydrates the client components'
 * registry from `RegistryProvider`.
 *
 * @stability unstable
 * @since 0.1.0
 */
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type * as EffectHydration from "effect/reactivity/Hydration";

import type { ArgsOf, Handle, LoadedHandle, Source } from "./Handle.ts";
import * as internal from "./internal/next.ts";

export {
	/**
	 * @since 0.1.0
	 */
	HydrateAtoms,
} from "./NextClient.tsx";

export {
	/**
	 * @since 0.1.0
	 */
	RegistryProvider,
} from "./RegistryProvider.tsx";

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
) => Handle<S> = internal.prefetch;

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
) => Promise<LoadedHandle<S>> = internal.ensure;

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
) => Promise<LoadedHandle<S>> = internal.fetch;

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
