/**
 * `HydrationBoundary` in server components, through the package's
 * `react-server` export condition.
 *
 * @stability unstable
 * @since 0.3.0
 */
import type * as React from "react";

import * as Hydration from "./Hydration.ts";
import {
	HydrationBoundary as ClientHydrationBoundary,
	type HydrationBoundaryProps,
} from "./ReactHydration.tsx";
import * as RequestRegistry from "./RequestRegistry.ts";

/**
 * Sends a server component's request registry to the client components
 * under it.
 *
 * **Details**
 *
 * With `registry`, it waits for the registry's seed, dehydrates the atoms
 * started so far, and renders the client `HydrationBoundary` with that
 * state. React serializes the state's promises with the payload, so a result
 * still loading streams in when it settles. With `state`, it passes that
 * state on.
 *
 * **Gotchas**
 *
 * Call the verbs before rendering it: each boundary sends what its registry
 * held when it rendered. It throws for a registry that isn't a request
 * registry, which every request would share.
 *
 * @stability unstable
 * @category components
 * @since 0.3.0
 */
export const HydrationBoundary = async (
	props: HydrationBoundaryProps,
): Promise<React.ReactNode> => {
	const registry = props.registry;
	if (registry === undefined) {
		return (
			<ClientHydrationBoundary state={props.state}>
				{props.children}
			</ClientHydrationBoundary>
		);
	}
	if (!RequestRegistry.isRequestRegistry(registry)) {
		throw new Error(
			"raf-effect-atom: HydrationBoundary got a registry that isn't a request registry, which would share results between requests. Pass raf-effect-atom/rsc's getRegistry(), or one makeRequestAtoms made.",
		);
	}
	await RequestRegistry.settled(registry);
	return (
		<ClientHydrationBoundary state={Hydration.dehydrate(registry)}>
			{props.children}
		</ClientHydrationBoundary>
	);
};
