import * as Predicate from "effect/Predicate";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";

/** Prepares a request registry before any loader verb starts an atom in it. */
export type Seed = (
	registry: AtomRegistry.AtomRegistry,
) => void | Promise<void>;

interface Seeding {
	/** `prefetch` starts that waited for the seed. */
	readonly deferred: Array<Promise<void>>;
	/** Whether the seed resolved. A seed that rejected stays in the way. */
	resolved: boolean;
	readonly seeded: Promise<void>;
}

const seedings = new WeakMap<AtomRegistry.AtomRegistry, Seeding>();

const waiting = (registry: AtomRegistry.AtomRegistry): Seeding | undefined => {
	const seeding = seedings.get(registry);
	return seeding === undefined || seeding.resolved ? undefined : seeding;
};

/**
 * Runs `seed` on `registry`. Until a seed's promise settles, the verbs wait
 * for it.
 */
export const run = (registry: AtomRegistry.AtomRegistry, seed: Seed): void => {
	const result = seed(registry);
	if (!Predicate.isPromiseLike(result)) {
		return;
	}
	const seeded = Promise.resolve(result);
	const seeding: Seeding = { deferred: [], resolved: false, seeded };
	seeded.then(
		() => {
			seeding.resolved = true;
		},
		() => undefined,
	);
	seedings.set(registry, seeding);
};

/**
 * The seed the verbs wait for: `undefined` once it has resolved, and the
 * rejected promise once it has failed.
 */
export const pending = (
	registry: AtomRegistry.AtomRegistry,
): Promise<void> | undefined => waiting(registry)?.seeded;

/**
 * Runs `start` once the registry's seed has resolved: at once, unless it's
 * still running. A seed that fails never runs it.
 */
export const afterSeed = (
	registry: AtomRegistry.AtomRegistry,
	start: () => void,
): void => {
	const seeding = waiting(registry);
	if (seeding === undefined) {
		start();
		return;
	}
	const started = seeding.seeded.then(start);
	// `settled` rethrows a failed start; a registry nobody dehydrates mustn't
	// crash the process with an unhandled rejection.
	started.catch(() => undefined);
	seeding.deferred.push(started);
};

/**
 * Waits for the registry's seed and the starts that waited for it, so
 * `Hydration.dehydrate` sees every atom the verbs started. Rejects with the
 * seed's error, or with a start's defect.
 */
export const settled = async (
	registry: AtomRegistry.AtomRegistry,
): Promise<void> => {
	const seeding = seedings.get(registry);
	if (seeding === undefined) {
		return;
	}
	await seeding.seeded;
	await Promise.all(seeding.deferred);
};
