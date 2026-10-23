import * as Cause from "effect/Cause";
import * as Option from "effect/Option";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";

import type { UseErrorBoundary } from "../claim.ts";
import * as FailedReads from "./failed-reads.ts";

// oxlint-disable-next-line typescript/no-explicit-any -- any atom's result
type AnyAtom = Atom.Atom<AsyncResult.AsyncResult<any, any>>;

type Family = (...args: ReadonlyArray<unknown>) => AnyAtom;

/**
 * Returns what a boundary's hook returns for the errors `owns` claims,
 * memoized per atom and per family so a component reads the same derived
 * atom on every render.
 *
 * @internal
 */
export const make = <Tags extends string>(
	owns: (error: unknown) => boolean,
): UseErrorBoundary<Tags> => {
	const wrapped = new WeakMap<AnyAtom, AnyAtom>();
	const families = new WeakMap<Family, Family>();
	const wrapAtom = (source: AnyAtom): AnyAtom => {
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
			FailedReads.record(get.registry, error.value, source);
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
	const wrapFamily = (family: Family): Family => {
		const cached = families.get(family);
		if (cached !== undefined) {
			return cached;
		}
		const made: Family = (...args) => wrapAtom(family(...args));
		families.set(family, made);
		return made;
	};
	// SAFETY: the overloads type what each branch returns: a wrapped atom for
	// an atom, a family of wrapped atoms for a family.
	return ((source: AnyAtom | Family) =>
		Atom.isAtom(source)
			? wrapAtom(source)
			: wrapFamily(source)) as UseErrorBoundary<Tags>;
};
