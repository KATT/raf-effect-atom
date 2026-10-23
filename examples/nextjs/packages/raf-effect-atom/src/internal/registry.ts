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
}): AtomRegistry.AtomRegistry =>
	isServer()
		? RequestRegistry.make()
		: AtomRegistry.make({
				defaultIdleTTL: options?.defaultIdleTTL ?? defaultIdleTTL,
				scheduleTask,
			});
