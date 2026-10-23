/**
 * A registry per server request.
 *
 * `@effect/atom-react`'s default `RegistryContext` is one registry for the
 * whole module, which on a server would share one user's results with every
 * other request. Each framework integration makes a request registry with
 * `make`, provides it through `RegistryContext`, and dehydrates it into the
 * response.
 *
 * @stability unstable
 * @since 0.1.0
 */
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";

import * as Seeds from "./internal/seeds.ts";

const requestRegistries = new WeakSet<AtomRegistry.AtomRegistry>();

/**
 * Prepares a request registry before the loader verbs start atoms in it,
 * such as by setting an atom to the request's cookie.
 *
 * @stability unstable
 * @category models
 * @since 0.2.0
 */
export type Seed = Seeds.Seed;

/**
 * Options for `make`.
 *
 * @stability unstable
 * @category models
 * @since 0.2.0
 */
export interface Options {
	/**
	 * Runs on the new registry before any verb starts an atom in it. When it
	 * returns a promise, `ensure` and `fetch` wait for it, and `prefetch`
	 * returns its handle at once and starts the atom once it resolves.
	 */
	readonly seed?: Seed | undefined;
}

/**
 * Creates the registry for one server request.
 *
 * **Details**
 *
 * - It's an ordinary `AtomRegistry`, marked as a request registry. On a
 *   request registry, `ensure` waits like `fetch` does, nothing revalidates
 *   in the background, and a loader's lease lasts until the registry is
 *   disposed. In development, the loader verbs refuse an atom that isn't
 *   serializable, because the browser would request it again.
 * - `seed` sets what the request's atoms need before they run, such as the
 *   page request's cookie for an RPC protocol that forwards it. It can be
 *   async, for request data only a promise gives, such as Next.js's
 *   `headers()`.
 *
 * **Gotchas**
 *
 * With an async seed, a `prefetch` before it settles starts its atom later,
 * so `Hydration.dehydrate` would miss it: wait for `settled` first, as the
 * framework integrations do.
 *
 * **Example**
 *
 * ```ts
 * import { RequestRegistry } from "raf-effect-atom"
 *
 * const registry = RequestRegistry.make({
 *   seed: (registry) => registry.set(requestCookie, request.headers.get("cookie") ?? undefined)
 * })
 * ```
 *
 * @stability unstable
 * @category constructors
 * @since 0.1.0
 */
export const make = (options?: Options): AtomRegistry.AtomRegistry => {
	const registry = AtomRegistry.make();
	requestRegistries.add(registry);
	if (options?.seed !== undefined) {
		Seeds.run(registry, options.seed);
	}
	return registry;
};

/**
 * Waits until a request registry's seed has settled and every atom a verb
 * started while it ran has started.
 *
 * **When to use**
 *
 * Use before `Hydration.dehydrate` on a registry with an async seed, outside
 * the framework integrations, which call it for you.
 *
 * **Details**
 *
 * Resolves at once for a registry without a seed, or whose seed was
 * synchronous. Rejects with the seed's error.
 *
 * @stability unstable
 * @category getters
 * @since 0.2.0
 */
export const settled = (registry: AtomRegistry.AtomRegistry): Promise<void> =>
	Seeds.settled(registry);

/**
 * A layer that provides a request registry as the `AtomRegistry`, disposed
 * when the layer's scope closes.
 *
 * **When to use**
 *
 * Use when the request is handled in Effect, around the loaders' verbs and
 * `dehydrate`.
 *
 * @see {@link make} for the registry it provides
 *
 * @stability unstable
 * @category layers
 * @since 0.1.0
 */
export const layer: Layer.Layer<AtomRegistry.AtomRegistry> = Layer.effect(
	AtomRegistry.AtomRegistry,
	Effect.acquireRelease(
		Effect.sync(() => make()),
		(registry) => Effect.sync(() => registry.dispose()),
	),
);

/**
 * Returns whether a registry was made by `make`, for one server request.
 *
 * @stability unstable
 * @category guards
 * @since 0.1.0
 */
export const isRequestRegistry = (
	registry: AtomRegistry.AtomRegistry,
): boolean => requestRegistries.has(registry);
