import * as Cause from "effect/Cause";
import * as Option from "effect/Option";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";

import * as FailedReads from "./failedReads.ts";

/** @internal */
export type Wrap<Tags extends string> = <A, E>(
	atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
) => Atom.Atom<AsyncResult.AsyncResult<A, Exclude<E, { readonly _tag: Tags }>>>;

/**
 * Returns a `wrap` for the errors `owns` claims, memoized per atom so a
 * component reads the same derived atom on every render.
 *
 * @internal
 */
export const make = <Tags extends string>(
	owns: (error: unknown) => boolean,
): Wrap<Tags> => {
	// oxlint-disable-next-line typescript/no-explicit-any -- any atom's result
	const wrapped = new WeakMap<Atom.Atom<any>, Atom.Atom<any>>();
	return (source) => {
		const cached = wrapped.get(source);
		if (cached !== undefined) {
			return cached;
		}
		const atom = Atom.transform(source, (get) => {
			const result = get(source);
			if (!AsyncResult.isFailure(result)) {
				return result;
			}
			const error = Cause.findErrorOption(result.cause);
			if (Option.isNone(error) || !owns(error.value)) {
				return result;
			}
			FailedReads.record(error.value, {
				atom: source,
				registry: get.registry,
			});
			return AsyncResult.failure(Cause.die(error.value), {
				previousSuccess: result.previousSuccess,
				waiting: result.waiting,
			});
		});
		// Effect's pointer from a derived atom to the atom that holds its value,
		// so a read hook can hydrate the source and wait for it. Set here rather
		// than through `transform`, which skips to the end of the source's own
		// chain: an AtomRpc query with reactivity keys points at an inner atom
		// that has no serialization key.
		const pointed = Object.assign(atom, { initialValueTarget: source });
		wrapped.set(source, pointed);
		return pointed;
	};
};
