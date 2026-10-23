import * as Predicate from "effect/Predicate";
import type * as Atom from "effect/reactivity/Atom";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";

// Per registry, so a server request's failures go with its registry, and an
// error object two registries fail with doesn't send one's `reset` to the
// other. Keyed by the thrown error, which is all a React error boundary
// receives.
const failedReads = new WeakMap<
	AtomRegistry.AtomRegistry,
	// oxlint-disable-next-line typescript/no-explicit-any -- any atom's result
	WeakMap<object, Atom.Atom<any>>
>();

/** @internal */
export const record = (
	registry: AtomRegistry.AtomRegistry,
	error: unknown,
	// oxlint-disable-next-line typescript/no-explicit-any -- any atom's result
	atom: Atom.Atom<any>,
): void => {
	if (!Predicate.isObject(error)) {
		return;
	}
	let byError = failedReads.get(registry);
	if (byError === undefined) {
		byError = new WeakMap();
		failedReads.set(registry, byError);
	}
	byError.set(error, atom);
};

/** The atom whose read in `registry` threw `error`. @internal */
export const get = (
	registry: AtomRegistry.AtomRegistry,
	error: unknown,
	// oxlint-disable-next-line typescript/no-explicit-any -- any atom's result
): Atom.Atom<any> | undefined =>
	Predicate.isObject(error) ? failedReads.get(registry)?.get(error) : undefined;
