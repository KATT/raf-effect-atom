import * as Atom from "effect/reactivity/Atom";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";

interface Lease {
	readonly release: () => void;
	timer: ReturnType<typeof setTimeout> | undefined;
}

type Key = Atom.Atom<unknown> | string;

interface Leases {
	readonly leases: Map<Key, Lease>;
	/** How many mounted components hold each atom. */
	readonly readers: Map<Key, number>;
}

const registries = new WeakMap<AtomRegistry.AtomRegistry, Leases>();

const leasesOf = (registry: AtomRegistry.AtomRegistry): Leases => {
	let state = registries.get(registry);
	if (state === undefined) {
		state = { leases: new Map(), readers: new Map() };
		registries.set(registry, state);
	}
	return state;
};

/** The registry's key for an atom: its serialization key, or the atom. */
export const keyOf = (atom: Atom.Atom<unknown>): Key =>
	Atom.isSerializable(atom) ? atom[Atom.SerializableTypeId].key : atom;

/**
 * Mounts `atom` until `release`, or until `ttl` milliseconds pass. Taking a
 * lease the atom already has restarts its timer. While a component holds the
 * atom (see `hold`), it takes none: the component keeps the atom mounted, and
 * a lease would keep it mounted after the component unmounts.
 */
export const take = (
	registry: AtomRegistry.AtomRegistry,
	atom: Atom.Atom<unknown>,
	ttl: number | undefined,
): void => {
	const state = leasesOf(registry);
	const key = keyOf(atom);
	if (state.readers.has(key)) {
		return;
	}
	let lease = state.leases.get(key);
	if (lease === undefined) {
		const unmount = registry.mount(atom);
		const created: Lease = {
			release: () => {
				clearTimeout(created.timer);
				state.leases.delete(key);
				unmount();
			},
			timer: undefined,
		};
		state.leases.set(key, created);
		lease = created;
	}
	clearTimeout(lease.timer);
	lease.timer = ttl === undefined ? undefined : setTimeout(lease.release, ttl);
};

/**
 * Marks `atom` as held by a component subscribed to it, until the returned
 * function runs. Ends the atom's lease, and `take` takes none while any
 * component holds it.
 */
export const hold = (
	registry: AtomRegistry.AtomRegistry,
	atom: Atom.Atom<unknown>,
): (() => void) => {
	const state = leasesOf(registry);
	const key = keyOf(atom);
	state.readers.set(key, (state.readers.get(key) ?? 0) + 1);
	state.leases.get(key)?.release();
	return () => {
		const count = (state.readers.get(key) ?? 1) - 1;
		if (count === 0) {
			state.readers.delete(key);
		} else {
			state.readers.set(key, count);
		}
	};
};
