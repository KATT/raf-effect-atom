import * as Predicate from "effect/Predicate";
import type * as Atom from "effect/reactivity/Atom";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";

/** @internal */
export interface FailedRead {
	// oxlint-disable-next-line typescript/no-explicit-any -- any atom's result
	readonly atom: Atom.Atom<any>;
	readonly registry: AtomRegistry.AtomRegistry;
}

// Keyed by the thrown error, which is all a React error boundary receives, so
// the boundary that catches it can refresh the atom that failed.
const failedReads = new WeakMap<object, FailedRead>();

/** @internal */
export const record = (error: unknown, read: FailedRead): void => {
	if (Predicate.isObject(error)) {
		failedReads.set(error, read);
	}
};

/** @internal */
export const get = (error: unknown): FailedRead | undefined =>
	Predicate.isObject(error) ? failedReads.get(error) : undefined;
