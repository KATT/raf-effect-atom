/**
 * The claiming step of typed error boundaries. A boundary claims errors by
 * `_tag`; its hook returns an atom with the claimed failures turned into
 * defects, recorded with the atom that failed, so a read throws them to the
 * boundary that claims them and gets a result typed without them.
 *
 * @stability unstable
 * @since 0.1.0
 */
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import type * as Types from "effect/Types";

/**
 * Literal type used as the boundary components' type identifier.
 *
 * @stability unstable
 * @category type IDs
 * @since 0.1.0
 */
export type TypeId = "~effect-atom-boundary/ErrorBoundary";

/**
 * Type identifier for the boundary components, which carry the tags they
 * claim.
 *
 * @stability unstable
 * @category type IDs
 * @since 0.1.0
 */
export const TypeId: TypeId = "~effect-atom-boundary/ErrorBoundary";

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
 * An `AsyncResult`, or a union of them, typed without the errors whose
 * `_tag` is in `Tags`: a failure with no error left is gone from the union,
 * so a read whose failures are all claimed is typed as a success.
 *
 * @stability unstable
 * @category utility types
 * @since 0.3.0
 */
export type UnclaimedResult<R, Tags extends string> =
	R extends AsyncResult.Success<infer A, infer E>
		? AsyncResult.Success<A, Unclaimed<E, Tags>>
		: R extends AsyncResult.Failure<infer A, infer E>
			? [Unclaimed<E, Tags>] extends [never]
				? never
				: AsyncResult.Failure<A, Unclaimed<E, Tags>>
			: R extends AsyncResult.Initial<infer A, infer E>
				? AsyncResult.Initial<A, Unclaimed<E, Tags>>
				: never;

/**
 * A boundary's hook: takes the result a component read under the boundary,
 * throws the failures this boundary and the boundaries above it claim, and
 * returns the result typed without them. Given an atom, or an atom family,
 * it returns it with those failures turned into defects instead.
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
	<R extends AsyncResult.AsyncResult<unknown, unknown>>(
		result: R,
	): UnclaimedResult<R, Tags>;
	<A, E>(
		atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
	): Atom.Atom<AsyncResult.AsyncResult<A, Unclaimed<E, Tags>>>;
	<Args extends ReadonlyArray<unknown>, A, E>(
		family: (...args: Args) => Atom.Atom<AsyncResult.AsyncResult<A, E>>,
	): (
		...args: Args
	) => Atom.Atom<AsyncResult.AsyncResult<A, Unclaimed<E, Tags>>>;
}
