/**
 * Streams a server registry into the browser's, typed failures intact, and
 * hydrates it without requesting anything again.
 *
 * `dehydrate` encodes the request registry's serializable atoms. Settled
 * results cross as values; results still loading cross as promises that
 * resolve when they settle, carried by the framework's own streaming.
 * `hydrate` applies settled values at once and holds each streamed result
 * until its promise resolves, so `useAtomResult` waits for it instead of
 * starting the atom. `hydrated` keeps a hydrated value on the atom's first
 * read instead of running its effect again.
 *
 * Typed failures survive because a serializable `AsyncResult` atom, such as
 * an `AtomRpc` query with a `serializationKey`, encodes its `Cause` with the
 * procedure's error Schemas: a server-side `IssueNotFound` decodes as an
 * `IssueNotFound` in the browser.
 *
 * @stability unstable
 * @since 0.1.0
 */
import * as Atom from "effect/reactivity/Atom";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as EffectHydration from "effect/reactivity/Hydration";

import * as Pending from "./internal/pending.ts";
import * as Sources from "./internal/sources.ts";

const copies = new WeakMap<Atom.Atom<unknown>, Atom.Atom<unknown>>();

/**
 * Returns a serializable atom that keeps its hydrated value on its first
 * read, instead of running its effect again.
 *
 * **When to use**
 *
 * The loader verbs and `useAtomResult` already read through it. Use it when
 * reading a hydrated atom with `@effect/atom-react`'s own hooks.
 *
 * **Details**
 *
 * The copy shares the atom's serialization key, so both read the same
 * registry node. It sets `skipInitialRun` on the atom's `Serializable`
 * metadata, and is memoized per atom, so every call returns the same copy.
 * An atom that isn't serializable, or already skips its initial run, is
 * returned as it is.
 *
 * **Gotchas**
 *
 * The copy keeps the hydrated value only for the first read: a refresh, or a
 * change to a dependency, runs the effect as usual. An `Initial` value never
 * skips the effect, which is why a result the server was still loading
 * crosses as a promise that `useAtomResult` waits for.
 *
 * **Example**
 *
 * ```ts
 * import { useAtomValue } from "@effect/atom-react"
 * import { Hydration } from "raf-effect-atom"
 *
 * const result = useAtomValue(Hydration.hydrated(issue(1)))
 * ```
 *
 * @see {@link Atom.serializable} for the metadata it copies
 *
 * @stability unstable
 * @category combinators
 * @since 0.1.0
 */
export const hydrated = <Self extends Atom.Atom<unknown>>(atom: Self): Self => {
	if (
		!Atom.isSerializable(atom) ||
		atom[Atom.SerializableTypeId].skipInitialRun === true
	) {
		return atom;
	}
	const cached = copies.get(atom);
	if (cached !== undefined) {
		// SAFETY: the copy was made from this atom below.
		return cached as Self;
	}
	const copy: Atom.Atom<unknown> = Object.assign(
		Object.create(Object.getPrototypeOf(atom)),
		{
			...atom,
			[Atom.SerializableTypeId]: {
				...atom[Atom.SerializableTypeId],
				skipInitialRun: true,
			},
		},
	);
	copies.set(atom, copy);
	// SAFETY: a copy of `atom` with the same prototype and fields, as
	// `Atom.serializable` makes its own.
	return copy as Self;
};

/**
 * Encodes a request registry's serializable atoms for the browser.
 *
 * **Details**
 *
 * `Hydration.dehydrate` with `encodeInitialAs: "promise"`: a settled result
 * crosses as its encoded value, and a result still loading crosses as a
 * promise of its encoded value, which resolves when it settles. The
 * framework's serializer carries the promises (TanStack Router's dehydrated
 * state, React's server component props, React Router's Single Fetch).
 *
 * **Gotchas**
 *
 * Only atoms in the registry when it's called are included, so call it once
 * the loaders have started theirs.
 *
 * @see {@link hydrate} for the browser side
 *
 * @stability unstable
 * @category dehydration
 * @since 0.1.0
 */
export const dehydrate = (
	registry: AtomRegistry.AtomRegistry,
): Array<EffectHydration.DehydratedAtom> =>
	Sources.remember(
		EffectHydration.dehydrate(registry, { encodeInitialAs: "promise" }),
		registry,
	);

/**
 * Applies dehydrated state to the browser's registry.
 *
 * **When to use**
 *
 * Use outside React, such as in a router's `hydrate` hook, before the app
 * renders. Inside React, use `HydrationBoundary`.
 *
 * **Details**
 *
 * Settled values go through `Hydration.hydrate`. A streamed result is held
 * until its promise resolves, then hydrated; until then `useAtomResult`
 * suspends on it instead of starting the atom, which would request it again.
 * A streamed result that can't be decoded, or whose promise rejects, is
 * dropped, and the atom runs in the browser.
 *
 * @see {@link dehydrate} for the server side
 *
 * @stability unstable
 * @category hydration
 * @since 0.1.0
 */
export const hydrate = (
	registry: AtomRegistry.AtomRegistry,
	state: Iterable<EffectHydration.DehydratedAtom>,
): void => {
	EffectHydration.hydrate(registry, Pending.split(registry, state));
};
