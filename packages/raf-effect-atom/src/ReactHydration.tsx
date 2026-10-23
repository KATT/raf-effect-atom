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
 * **Example**
 *
 * ```tsx
 * import { HydrationBoundary } from "raf-effect-atom"
 *
 * <HydrationBoundary state={loaderData.atoms}>
 *   <IssuePage id={id} />
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
	const registry = React.useContext(RegistryContext);
	const state = props.state;
	// Holding a streamed result must happen in render, before the children
	// read it; it's idempotent per entry.
	const settled = React.useMemo(
		() => (state === undefined ? undefined : Pending.split(registry, state)),
		[registry, state],
	);
	return (
		<AtomHydrationBoundary state={settled}>
			{props.children}
		</AtomHydrationBoundary>
	);
};
