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
import type * as Hydration from "effect/reactivity/Hydration";
import * as React from "react";

import * as Pending from "./internal/pending.ts";
import * as Registry from "./internal/registry.ts";
import * as Sources from "./internal/sources.ts";

/**
 * Props for `HydrationBoundary`.
 *
 * @stability unstable
 * @category models
 * @since 0.1.0
 */
export interface HydrationBoundaryProps {
	readonly children?: React.ReactNode | undefined;
	/** The state `Hydration.dehydrate` returned on the server. */
	readonly state?: Iterable<Hydration.DehydratedAtom> | undefined;
}

/**
 * Hydrates the state a server registry dehydrated, streamed results
 * included.
 *
 * **When to use**
 *
 * Use where the server's state reaches the React tree as a prop, such as
 * React Server Components props or a React Router loader's data. A router
 * that hydrates before rendering calls `Hydration.hydrate` instead.
 *
 * **Details**
 *
 * Settled values go to `@effect/atom-react`'s `HydrationBoundary`, which
 * hydrates new atoms during render and existing ones after commit. Each
 * streamed result is held until it arrives, so `useAtomResult` waits for it
 * instead of requesting it again.
 *
 * During server rendering, when `state` is the array `dehydrate` returned,
 * as React Router passes a loader's data to the server render, the children
 * read the registry it came from instead of a copy. The loaders' atoms are
 * there, so an `effect-atom-boundary` boundary sees their failures before
 * its children read them and renders its handler on the server.
 *
 * **Example**
 *
 * ```tsx
 * import { HydrationBoundary } from "raf-effect-atom"
 *
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
	const context = React.useContext(RegistryContext);
	const state = props.state;
	const source = Registry.isServer() ? Sources.sourceOf(state) : undefined;
	const registry = source ?? context;
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
