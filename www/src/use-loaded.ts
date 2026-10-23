import { AsyncResult, type Atom } from "effect/reactivity";
import { useAtomResult } from "raf-effect-atom";

/**
 * Reads an atom that can't fail with a typed error, such as a page or a
 * demo's code, as its value. A defect still goes to the nearest error
 * boundary.
 */
export function useLoaded<A>(
	atom: Atom.Atom<AsyncResult.AsyncResult<A, never>>,
): A {
	return AsyncResult.getOrThrow(useAtomResult(atom));
}
