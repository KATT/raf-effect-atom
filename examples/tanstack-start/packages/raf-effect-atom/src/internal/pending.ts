import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as Predicate from "effect/Predicate";
import * as Hydration from "effect/reactivity/Hydration";

const held = new WeakMap<
	AtomRegistry.AtomRegistry,
	WeakSet<Hydration.DehydratedAtomValue>
>();

const pending = new WeakMap<
	AtomRegistry.AtomRegistry,
	Map<string, Promise<void>>
>();

/** Each key's latest stream, kept once it settles. */
const streams = new WeakMap<
	AtomRegistry.AtomRegistry,
	Map<string, Promise<void>>
>();

/** The promise of a streamed result still on its way, if there is one. */
export const get = (
	registry: AtomRegistry.AtomRegistry,
	key: string,
): Promise<void> | undefined => pending.get(registry)?.get(key);

/**
 * The promise of a key's streamed result, settled or not. A component that
 * suspended on it with `React.use` must call `React.use` again when React
 * retries it, or React reports a conditional `use`. Once settled, it's
 * marked fulfilled the way React marks the thenables it tracks, so `use`
 * returns at once instead of suspending again.
 */
export const stream = (
	registry: AtomRegistry.AtomRegistry,
	key: string,
): Promise<void> | undefined => streams.get(registry)?.get(key);

const hold = (
	registry: AtomRegistry.AtomRegistry,
	entry: Hydration.DehydratedAtomValue,
	result: Promise<unknown>,
): void => {
	let entries = held.get(registry);
	if (entries === undefined) {
		entries = new WeakSet();
		held.set(registry, entries);
	}
	if (entries.has(entry)) {
		return;
	}
	entries.add(entry);
	let byKey = pending.get(registry);
	if (byKey === undefined) {
		byKey = new Map();
		pending.set(registry, byKey);
	}
	if (byKey.has(entry.key)) {
		return;
	}
	let latest = streams.get(registry);
	if (latest === undefined) {
		latest = new Map();
		streams.set(registry, latest);
	}
	const owner = byKey;
	const done = () => {
		owner.delete(entry.key);
	};
	const fulfilled = () => {
		Object.assign(promise, { status: "fulfilled", value: undefined });
	};
	// React's server component payload streams thenables whose `then`
	// returns nothing, so adopt the result as a promise before chaining.
	const promise = Promise.resolve(result).then(
		(value) => {
			done();
			// A result the server couldn't encode resolves to a symbol.
			if (!Predicate.isSymbol(value)) {
				const resolved: Hydration.DehydratedAtomValue = {
					...entry,
					resultPromise: undefined,
					value,
				};
				Hydration.hydrate(registry, [resolved]);
			}
			fulfilled();
		},
		() => {
			done();
			fulfilled();
		},
	);
	owner.set(entry.key, promise);
	latest.set(entry.key, promise);
};

/**
 * Holds back each streamed entry of `state` until its promise resolves, and
 * returns the settled ones.
 */
export const split = (
	registry: AtomRegistry.AtomRegistry,
	state: Iterable<Hydration.DehydratedAtom>,
): Array<Hydration.DehydratedAtomValue> => {
	const settled: Array<Hydration.DehydratedAtomValue> = [];
	for (const entry of Hydration.toValues(Array.from(state))) {
		if (entry.resultPromise === undefined) {
			settled.push(entry);
		} else {
			hold(registry, entry, entry.resultPromise);
		}
	}
	return settled;
};
