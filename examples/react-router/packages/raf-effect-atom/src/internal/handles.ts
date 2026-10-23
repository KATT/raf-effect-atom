import * as Predicate from "effect/Predicate";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";

import type {
	ArgsOf,
	Handle,
	HandleKey,
	LoadedHandle,
	Source,
} from "../Handle.ts";
import * as Leases from "./leases.ts";

/** The atom a source makes for its arguments. */
export const atomOf = (
	source: Source,
	args: ReadonlyArray<unknown>,
	// oxlint-disable-next-line typescript/no-explicit-any -- any atom's result
): Atom.Atom<AsyncResult.AsyncResult<any, any>> =>
	Atom.isAtom(source) ? source : source(...args);

/**
 * The atom the loader starts and the server sends for `atom`: the first
 * serializable atom in its `initialValueTarget` chain, starting with `atom`.
 * An AtomRpc query is serializable itself, though it points at an inner atom.
 */
export const sourceOf = (atom: Atom.Atom<unknown>): Atom.Atom<unknown> => {
	for (
		let target: Atom.Atom<unknown> | undefined = atom;
		target !== undefined;
		target = target.initialValueTarget
	) {
		if (Atom.isSerializable(target)) {
			return target;
		}
	}
	return atom;
};

/** The registry key a handle records: its source atom's serialization key. */
const keyOf = <S>(atom: Atom.Atom<unknown>): HandleKey<S> | undefined => {
	const key = Leases.keyOf(sourceOf(atom));
	if (!Predicate.isString(key)) {
		return undefined;
	}
	// SAFETY: the brand is type-only, and `atom` is the one `S` made.
	return key as HandleKey<S>;
};

export const make = <S extends Source>(
	args: ArgsOf<S>,
	atom: Atom.Atom<unknown>,
): Handle<S> => ({ args, key: keyOf<S>(atom) });

export const loaded = <S extends Source>(
	args: ArgsOf<S>,
	atom: Atom.Atom<unknown>,
): LoadedHandle<S> => ({ args, key: keyOf<S>(atom), loaded: true });
