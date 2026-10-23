import * as Atom from "effect/reactivity/Atom";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";

/**
 * Refreshes the atom the registry runs for `atom`'s key. An `Atom.family`
 * makes a member again once the garbage collector takes it, such as an
 * AtomRpc query: the new atom has the same serialization key, but the inner
 * atoms its refresh reaches aren't the ones the registry's node runs, so
 * refreshing it sends no request.
 *
 * @internal
 */
export const node = (
	registry: AtomRegistry.AtomRegistry,
	// oxlint-disable-next-line typescript/no-explicit-any -- any atom's result
	atom: Atom.Atom<any>,
): void => {
	const key = Atom.isSerializable(atom)
		? atom[Atom.SerializableTypeId].key
		: atom;
	registry.refresh(registry.getNodes().get(key)?.atom ?? atom);
};
