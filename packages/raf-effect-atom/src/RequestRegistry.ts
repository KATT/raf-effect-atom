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

const requestRegistries = new WeakSet<AtomRegistry.AtomRegistry>();

/**
 * Creates the registry for one server request.
 *
 * **Details**
 *
 * It's an ordinary `AtomRegistry`, marked as a request registry. On a
 * request registry, `ensure` waits like `fetch` does, nothing revalidates in
 * the background, and a loader's lease lasts until the registry is disposed.
 * In development, the loader verbs refuse an atom that isn't serializable,
 * because the browser would request it again.
 *
 * **Example**
 *
 * ```ts
 * import { RequestRegistry } from "raf-effect-atom"
 *
 * const registry = RequestRegistry.make()
 * ```
 *
 * @stability unstable
 * @category constructors
 * @since 0.1.0
 */
export const make = (): AtomRegistry.AtomRegistry => {
	const registry = AtomRegistry.make();
	requestRegistries.add(registry);
	return registry;
};

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
