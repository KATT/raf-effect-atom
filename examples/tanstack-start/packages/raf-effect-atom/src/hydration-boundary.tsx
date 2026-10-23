/**
 * Applies a server registry's dehydrated state to the nearest
 * `RegistryContext`, while rendering.
 *
 * @stability unstable
 * @since 0.1.0
 */
"use client";

import {
	HydrationBoundary as AtomHydrationBoundary,
	RegistryContext,
} from "@effect/atom-react";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type * as Hydration from "effect/reactivity/Hydration";
import * as React from "react";

import * as Pending from "./internal/pending.ts";
import * as Registry from "./internal/registry.ts";
import * as Sources from "./internal/sources.ts";

/**
 * Props for `HydrationBoundary`: the request's `registry` in a server
 * component, or the `state` it dehydrated anywhere else.
 *
 * @stability unstable
 * @category models
 * @since 0.1.0
 */
export type HydrationBoundaryProps =
	| {
			readonly children?: React.ReactNode | undefined;
			/**
			 * The request registry of the server component render, such as
			 * `raf-effect-atom/rsc`'s `getRegistry()`. Server components only.
			 */
			readonly registry: AtomRegistry.AtomRegistry;
			readonly state?: never;
	  }
	| {
			readonly children?: React.ReactNode | undefined;
			readonly registry?: never;
			/** The state `Hydration.dehydrate` returned on the server. */
			readonly state?: Iterable<Hydration.DehydratedAtom> | undefined;
	  };

/**
 * Hydrates the state a server registry dehydrated, streamed results
 * included.
 *
 * **When to use**
 *
 * Use where the server's state reaches the React tree through rendering
 * rather than a router: a server component's registry, or a React Router
 * loader's data. A router that hydrates before rendering calls
 * `Hydration.hydrate` instead.
 *
 * **Details**
 *
 * In a server component, pass the request's `registry`. Server components
 * get their own build of `HydrationBoundary` through the package's
 * `react-server` export condition: it waits for the registry's seed,
 * dehydrates it, and sends the state with the server component's payload,
 * so results still loading stream in as they settle.
 *
 * Anywhere else, pass the `state` a loader dehydrated. Settled values go to
 * `@effect/atom-react`'s `HydrationBoundary`, which hydrates new atoms
 * during render and existing ones after commit. Each streamed result is
 * held until it arrives, so `useAtomResult` waits for it instead of
 * requesting it again.
 *
 * During server rendering, when `state` is the array `dehydrate` returned,
 * as React Router passes a loader's data to the server render, the children
 * read the registry it came from instead of a copy. The loaders' atoms are
 * there, so an `effect-atom-boundary` boundary sees their failures before
 * its children read them and renders its handler on the server.
 *
 * **Gotchas**
 *
 * `registry` works only in server components: in a client component it
 * throws, since a registry can't cross to the browser. In development, it
 * throws during server rendering when the registry isn't a request
 * registry, such as `@effect/atom-react`'s default one, which every request
 * shares: one request's state would reach the others.
 *
 * **Example**
 *
 * ```tsx
 * import { HydrationBoundary } from "raf-effect-atom"
 * import { ensure, getRegistry } from "raf-effect-atom/rsc"
 *
 * // A server component
 * export default async function IssueRoute(props: { params: Promise<{ id: string }> }) {
 *   const handle = await ensure(issue, Number((await props.params).id))
 *   return (
 *     <HydrationBoundary registry={getRegistry()}>
 *       <IssuePage issue={handle} />
 *     </HydrationBoundary>
 *   )
 * }
 *
 * // A React Router route component
 * <HydrationBoundary state={loaderData.atoms}>
 *   <IssuePage issue={loaderData.issue} />
 * </HydrationBoundary>
 * ```
 *
 * @stability unstable
 * @category components
 * @since 0.1.0
 */
export const HydrationBoundary = (
	props: HydrationBoundaryProps,
): React.ReactNode => {
	// The types allow `registry` here: TypeScript doesn't see the
	// `react-server` condition, so both builds have one type.
	if (props.registry !== undefined) {
		throw new Error(
			"raf-effect-atom: HydrationBoundary needs `state` here. `registry` works only in server components.",
		);
	}
	const context = React.useContext(RegistryContext);
	const state = props.state;
	const source = Registry.isServer() ? Sources.sourceOf(state) : undefined;
	const registry = source ?? context;
	Registry.requireRequestRegistry(registry, "HydrationBoundary");
	// Holding a streamed result must happen in render, before the children
	// read it; it's idempotent per entry.
	const settled = React.useMemo(
		() =>
			state === undefined || source !== undefined
				? undefined
				: Pending.split(registry, state),
		[registry, source, state],
	);
	return (
		<RegistryContext.Provider value={registry}>
			<AtomHydrationBoundary state={settled}>
				{props.children}
			</AtomHydrationBoundary>
		</RegistryContext.Provider>
	);
};
