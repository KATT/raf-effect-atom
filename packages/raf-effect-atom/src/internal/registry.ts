import { scheduleTask } from "@effect/atom-react";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";

import * as RequestRegistry from "../RequestRegistry.ts";

export const isServer = (): boolean => !("window" in globalThis);

/**
 * A request registry on the server, and in the browser a registry like
 * `@effect/atom-react`'s `RegistryProvider` makes.
 */
export const make = (): AtomRegistry.AtomRegistry =>
	isServer()
		? RequestRegistry.make()
		: AtomRegistry.make({ defaultIdleTTL: 400, scheduleTask });
