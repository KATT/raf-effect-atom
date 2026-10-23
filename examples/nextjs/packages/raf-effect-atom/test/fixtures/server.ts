import * as Effect from "effect/Effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";

import { Hydration, RequestRegistry } from "../../src/index.ts";
import { wire } from "./wire.ts";

/**
 * Runs a server request's loaders on a request registry and dehydrates it,
 * sending the state across a wire. The registry lives until the result is
 * disposed, as it does until a response finishes.
 */
export const load = async (
	loaders: Effect.Effect<unknown, never, AtomRegistry.AtomRegistry>,
) => {
	const registry = RequestRegistry.make();
	await Effect.runPromise(
		loaders.pipe(Effect.provideService(AtomRegistry.AtomRegistry, registry)),
	);
	return {
		registry,
		state: wire(Hydration.dehydrate(registry)),
		[Symbol.dispose]: () => registry.dispose(),
	};
};
