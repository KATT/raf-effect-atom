import { scheduleTask } from "@effect/atom-react";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";

import * as RequestRegistry from "../RequestRegistry.ts";

export const isServer = (): boolean => !("window" in globalThis);

/** `@effect/atom-react`'s default registry keeps an unused atom this long. */
const defaultIdleTTL = 400;

/**
 * A request registry on the server, and in the browser a registry like
 * `@effect/atom-react`'s `RegistryProvider` makes.
 */
export const make = (options?: {
	readonly defaultIdleTTL?: number | undefined;
	readonly seed?: RequestRegistry.Seed | undefined;
}): AtomRegistry.AtomRegistry =>
	isServer()
		? RequestRegistry.make({ seed: options?.seed })
		: AtomRegistry.make({
				defaultIdleTTL: options?.defaultIdleTTL ?? defaultIdleTTL,
				scheduleTask,
			});

let mounted: AtomRegistry.AtomRegistry | undefined;

/**
 * Records the browser registry a `RegistryProvider` provides while it's
 * mounted, for code outside React, such as React Router's client
 * middleware. Returns the cleanup that forgets it.
 */
export const mount = (registry: AtomRegistry.AtomRegistry): (() => void) => {
	mounted = registry;
	return () => {
		if (mounted === registry) {
			mounted = undefined;
		}
	};
};

/** The browser registry of the mounted `RegistryProvider`, if one is. */
export const current = (): AtomRegistry.AtomRegistry | undefined => mounted;
