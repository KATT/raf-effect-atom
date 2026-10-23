/**
 * Connects the loader verbs to TanStack Router and TanStack Start.
 *
 * `getRouter` runs once per request on the server and once in the browser.
 * It makes the registry with `makeRegistry`, puts `Loader.make(registry)` on
 * the router context for the loaders, and calls `setupRouterAtoms`, which
 * provides the registry to the app and sends it from the server to the
 * browser through the router's own dehydration.
 *
 * **Example**
 *
 * ```tsx
 * import { createRouter } from "@tanstack/react-router"
 * import { Loader } from "raf-effect-atom"
 * import { makeRegistry, setupRouterAtoms } from "raf-effect-atom/tanstack-router"
 *
 * export function getRouter() {
 *   const registry = makeRegistry()
 *   const router = createRouter({
 *     routeTree,
 *     context: { atoms: Loader.make(registry) }
 *   })
 *   setupRouterAtoms({ router, registry })
 *   return router
 * }
 * ```
 *
 * @stability unstable
 * @since 0.1.0
 */
import { RegistryContext } from "@effect/atom-react";
import type { AnyRouter } from "@tanstack/react-router";
import * as Predicate from "effect/Predicate";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type * as EffectHydration from "effect/reactivity/Hydration";
import * as React from "react";

import * as Hydration from "./hydration.ts";
import * as Registry from "./internal/registry.ts";
import * as RequestRegistry from "./request-registry.ts";

/**
 * The key `setupRouterAtoms` adds to the router's dehydrated state.
 *
 * @stability unstable
 * @category models
 * @since 0.1.0
 */
export interface DehydratedRouterAtoms {
	readonly "raf-effect-atom": ReadonlyArray<EffectHydration.DehydratedAtom>;
}

/**
 * Options for `setupRouterAtoms`.
 *
 * @stability unstable
 * @category models
 * @since 0.1.0
 */
export interface RouterAtomsOptions<TRouter extends AnyRouter> {
	/** The registry the router context's loader verbs run on. */
	readonly registry: AtomRegistry.AtomRegistry;
	readonly router: TRouter;
}

/**
 * Creates the registry for one `getRouter` call: a request registry on the
 * server, and in the browser a registry like `@effect/atom-react`'s
 * `RegistryProvider` makes.
 *
 * **Details**
 *
 * The server is anywhere without a `window`. To decide otherwise, make the
 * registry with `RequestRegistry.make` on the server and `AtomRegistry.make`
 * in the browser.
 *
 * @stability unstable
 * @category constructors
 * @since 0.1.0
 */
export const makeRegistry: () => AtomRegistry.AtomRegistry = Registry.make;

const hasRouterAtoms = (value: unknown): value is DehydratedRouterAtoms =>
	Predicate.hasProperty(value, "raf-effect-atom") &&
	Array.isArray(value["raf-effect-atom"]);

/**
 * Provides a registry to a TanStack router's app and streams it from the
 * server to the browser.
 *
 * **Details**
 *
 * - Wraps the app in `RegistryContext.Provider` through the router's `Wrap`
 *   option, inside any `Wrap` it has already.
 * - On the server, adds `Hydration.dehydrate(registry)` to the router's
 *   dehydrated state once the loaders have run, so results still loading
 *   cross as promises on the router's stream, and disposes the registry when
 *   the response finishes.
 * - In the browser, hydrates the registry from that state before the app
 *   renders.
 *
 * **Gotchas**
 *
 * The server's registry must be a request registry and the browser's must
 * not, so it throws otherwise: a registry shared between requests would send
 * one user's results to another. Only atoms in the registry when the loaders
 * finish are sent; one first read while rendering runs again in the browser.
 *
 * @stability unstable
 * @category integrations
 * @since 0.1.0
 */
export const setupRouterAtoms = <TRouter extends AnyRouter>(
	options: RouterAtomsOptions<TRouter>,
): void => {
	const router = options.router;
	const registry = options.registry;
	if (router.isServer !== RequestRegistry.isRequestRegistry(registry)) {
		throw new Error(
			router.isServer
				? "raf-effect-atom: setupRouterAtoms got a server router without a request registry, which would share results between requests. Make it with makeRegistry or RequestRegistry.make."
				: "raf-effect-atom: setupRouterAtoms got a browser router with a request registry. Make it with makeRegistry or AtomRegistry.make.",
		);
	}

	const Wrap = router.options.Wrap ?? React.Fragment;
	router.options.Wrap = (props: { readonly children: React.ReactNode }) => (
		<RegistryContext.Provider value={registry}>
			<Wrap>{props.children}</Wrap>
		</RegistryContext.Provider>
	);

	if (router.isServer) {
		let disposed = false;
		// Registered before `router.load()`, so a redirect or an error thrown
		// before dehydration still disposes the registry.
		router.serverSsrLifecycle = {
			...router.serverSsrLifecycle,
			onServerSsrAttach: [
				...(router.serverSsrLifecycle?.onServerSsrAttach ?? []),
				(serverSsr) => {
					serverSsr.onCleanup(() => {
						disposed = true;
						registry.dispose();
					});
				},
			],
		};
		const dehydrate = router.options.dehydrate;
		router.options.dehydrate = async () => {
			const dehydrated: unknown = await dehydrate?.();
			if (disposed) {
				return dehydrated;
			}
			const atoms: DehydratedRouterAtoms = {
				"raf-effect-atom": Hydration.dehydrate(registry),
			};
			return Predicate.isObject(dehydrated)
				? { ...dehydrated, ...atoms }
				: atoms;
		};
	} else {
		const hydrate = router.options.hydrate;
		router.options.hydrate = async (dehydrated: unknown) => {
			await hydrate?.(dehydrated);
			if (hasRouterAtoms(dehydrated)) {
				Hydration.hydrate(registry, dehydrated["raf-effect-atom"]);
			}
		};
	}
};
