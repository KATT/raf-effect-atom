import * as Atom from "effect/reactivity/Atom";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";

interface Lease {
	readonly release: () => void;
	timer: ReturnType<typeof setTimeout> | undefined;
}

const leases = new WeakMap<
	AtomRegistry.AtomRegistry,
	Map<Atom.Atom<unknown> | string, Lease>
>();

/** The registry's key for an atom: its serialization key, or the atom. */
export const keyOf = (atom: Atom.Atom<unknown>): Atom.Atom<unknown> | string =>
	Atom.isSerializable(atom) ? atom[Atom.SerializableTypeId].key : atom;

/**
 * Mounts `atom` until `release`, or until `ttl` milliseconds pass. Taking a
 * lease the atom already has restarts its timer.
 */
export const take = (
	registry: AtomRegistry.AtomRegistry,
	atom: Atom.Atom<unknown>,
	ttl: number | undefined,
): void => {
	let byKey = leases.get(registry);
	if (byKey === undefined) {
		byKey = new Map();
		leases.set(registry, byKey);
	}
	const key = keyOf(atom);
	let lease = byKey.get(key);
	if (lease === undefined) {
		const unmount = registry.mount(atom);
		const owner = byKey;
		const created: Lease = {
			release: () => {
				clearTimeout(created.timer);
				owner.delete(key);
				unmount();
			},
			timer: undefined,
		};
		byKey.set(key, created);
		lease = created;
	}
	clearTimeout(lease.timer);
	lease.timer = ttl === undefined ? undefined : setTimeout(lease.release, ttl);
};

/** Releases `atom`'s lease, if it has one. */
export const release = (
	registry: AtomRegistry.AtomRegistry,
	atom: Atom.Atom<unknown>,
): void => {
	leases.get(registry)?.get(keyOf(atom))?.release();
};
