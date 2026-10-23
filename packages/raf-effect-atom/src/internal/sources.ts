import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type * as Hydration from "effect/reactivity/Hydration";

/** The registry each `dehydrate` result came from, while it's referenced. */
const sources = new WeakMap<
	Iterable<Hydration.DehydratedAtom>,
	AtomRegistry.AtomRegistry
>();

export const remember = (
	state: Array<Hydration.DehydratedAtom>,
	registry: AtomRegistry.AtomRegistry,
): Array<Hydration.DehydratedAtom> => {
	sources.set(state, registry);
	return state;
};

/**
 * The registry `state` was dehydrated from, when it's the same object
 * `dehydrate` returned: during server rendering by a framework that passes
 * loader data to components without serializing it, such as React Router.
 */
export const sourceOf = (
	state: Iterable<Hydration.DehydratedAtom> | undefined,
): AtomRegistry.AtomRegistry | undefined =>
	state === undefined ? undefined : sources.get(state);
