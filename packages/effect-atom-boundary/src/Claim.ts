/**
 * The claiming step of typed error boundaries. A boundary claims errors by
 * `_tag`; its claims' `wrap` returns an atom with the claimed failures turned
 * into defects, recorded with the atom that failed, so a read throws them to
 * the boundary that claims them and gets a result typed without them.
 *
 * @stability unstable
 * @since 0.1.0
 */
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import type * as Types from "effect/Types";

/**
 * Literal type used as the `ErrorBoundaryClaims` type identifier.
 *
 * @stability unstable
 * @category type IDs
 * @since 0.1.0
 */
export type TypeId = "~effect-atom-boundary/ErrorBoundaryClaims";

/**
 * Type identifier for `ErrorBoundaryClaims` and the boundary components that
 * carry the tags they claim.
 *
 * @stability unstable
 * @category type IDs
 * @since 0.1.0
 */
export const TypeId: TypeId = "~effect-atom-boundary/ErrorBoundaryClaims";

/**
 * The `_tag`s of an error union.
 *
 * @stability unstable
 * @category utility types
 * @since 0.1.0
 */
export type TagsOf<E> = E extends { readonly _tag: infer Tag extends string }
	? Tag
	: never;

/**
 * The errors of `E` whose `_tag` isn't in `Tags`.
 *
 * @stability unstable
 * @category utility types
 * @since 0.1.0
 */
export type Unclaimed<E, Tags extends string> = Exclude<
	E,
	{ readonly _tag: Tags }
>;

/**
 * Variance marker carrying the tags a boundary claims.
 *
 * @stability unstable
 * @category models
 * @since 0.1.0
 */
export interface Variance<Tags extends string> {
	readonly [TypeId]: {
		readonly _Tags: Types.Covariant<Tags>;
	};
}

/**
 * The errors a boundary and the boundaries above it claim, by `_tag`, as its
 * hook returns them.
 *
 * **When to use**
 *
 * Use `wrap` on the atoms, or the atom families, a component reads under the
 * boundary, to throw the claimed failures to their boundaries and narrow the
 * result to the rest.
 *
 * **Details**
 *
 * `wrap` returns a derived atom, memoized per atom, or for an atom family
 * the family of them, memoized per family. A claimed failure is
 * `Cause.die(error)` in its value, so a read that throws defects, such as
 * `useAtomSuspense` or `raf-effect-atom`'s `useAtomResult`, throws the error
 * itself; any other result passes through. The derived atom points at the
 * atom with `initialValueTarget`, so a read hook that hydrates can read the
 * atom's node, and `reset` refreshes the atom.
 *
 * **Gotchas**
 *
 * Code that inspects the derived atom's value sees a defect where the atom
 * failed with a claimed error: `AsyncResult.error` returns `None` for it.
 * The derived atom isn't serializable: `raf-effect-atom`'s loader verbs
 * start the atom it points at, whichever of the two a loader passes them.
 *
 * @stability unstable
 * @category models
 * @since 0.1.0
 */
export interface ErrorBoundaryClaims<
	Tags extends string,
> extends Variance<Tags> {
	/** Returns whether this boundary or one above it claims `error`. */
	readonly owns: (error: unknown) => boolean;
	/**
	 * Returns the atom with the claimed failures turned into defects, so a
	 * read throws them to the boundary that claims them, typed without them;
	 * or, for an atom family, the family of those atoms.
	 */
	readonly wrap: Wrap<Tags>;
}

/**
 * Turns the failures with a claimed tag into defects, in an atom or in each
 * atom of a family, and types the result without them.
 *
 * **Details**
 *
 * Memoized per atom and per family. A family is any function from arguments
 * to an `AsyncResult` atom, such as an `AtomRpc` query: its wrapper makes
 * the wrapped atom of `family(...args)`, so a reader that takes a family
 * and its arguments, such as `raf-effect-atom`'s `useAtomResult` with a
 * handle, reads it with the claimed failures thrown.
 *
 * @stability unstable
 * @category models
 * @since 0.1.0
 */
export interface Wrap<Tags extends string> {
	<A, E>(
		atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
	): Atom.Atom<AsyncResult.AsyncResult<A, Unclaimed<E, Tags>>>;
	<Args extends ReadonlyArray<unknown>, A, E>(
		family: (...args: Args) => Atom.Atom<AsyncResult.AsyncResult<A, E>>,
	): (
		...args: Args
	) => Atom.Atom<AsyncResult.AsyncResult<A, Unclaimed<E, Tags>>>;
}

/**
 * A boundary's hook: takes an atom, or an atom family, that a component reads
 * under the boundary, and returns it with the failures this boundary and the
 * boundaries above it claim turned into defects, typed without them.
 *
 * **When to use**
 *
 * Pass it each atom or family a component reads under the boundary, to throw
 * the claimed failures to their boundaries and narrow the result to the
 * rest.
 *
 * **Details**
 *
 * It returns a derived atom, memoized per atom, or for an atom family the
 * family of them, memoized per family. A family is any function from
 * arguments to an `AsyncResult` atom, such as an `AtomRpc` query, so a
 * reader that takes a family and its arguments, such as `raf-effect-atom`'s
 * `useAtomResult` with a handle, reads it with the claimed failures thrown.
 * A claimed failure is `Cause.die(error)` in the derived atom's value, so a
 * read that throws defects, such as `useAtomSuspense` or `useAtomResult`,
 * throws the error itself; any other result passes through. The derived atom
 * points at the atom with `initialValueTarget`, so a read hook that hydrates
 * can read the atom's node, and `reset` refreshes the atom.
 *
 * **Gotchas**
 *
 * It's a hook: call it unconditionally, and for an atom only some renders
 * read, pass the family. It throws outside its boundary. Code that inspects
 * the derived atom's value sees a defect where the atom failed with a claimed
 * error: `AsyncResult.error` returns `None` for it. The derived atom isn't
 * serializable: `raf-effect-atom`'s loader verbs start the atom it points at,
 * whichever of the two a loader passes them.
 *
 * @stability unstable
 * @category models
 * @since 0.1.0
 */
export interface UseErrorBoundary<Tags extends string> {
	<A, E>(
		atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
	): Atom.Atom<AsyncResult.AsyncResult<A, Unclaimed<E, Tags>>>;
	<Args extends ReadonlyArray<unknown>, A, E>(
		family: (...args: Args) => Atom.Atom<AsyncResult.AsyncResult<A, E>>,
	): (
		...args: Args
	) => Atom.Atom<AsyncResult.AsyncResult<A, Unclaimed<E, Tags>>>;
}
