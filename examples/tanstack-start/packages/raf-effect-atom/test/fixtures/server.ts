import * as Effect from "effect/Effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";

import { Hydration, RequestRegistry } from "../../src/index.ts";
import { wire } from "./wire.ts";

/**
 * Runs a server request's loaders on a request registry and dehydrates it,
 * sending the state and the loaders' handles across a wire. The registry
 * lives until the result is disposed, as it does until a response finishes.
 */
export const load = async <A>(
	loaders: Effect.Effect<A, never, AtomRegistry.AtomRegistry>,
) => {
	const registry = RequestRegistry.make();
	const handles = await Effect.runPromise(
		loaders.pipe(Effect.provideService(AtomRegistry.AtomRegistry, registry)),
	);
	return {
		handles: structuredClone(handles),
		registry,
		state: wire(Hydration.dehydrate(registry)),
		[Symbol.dispose]: () => registry.dispose(),
	};
};
