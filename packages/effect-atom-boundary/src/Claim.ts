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
 * Use `wrap` on the atoms a component reads under the boundary, to throw the
 * claimed failures to their boundaries and narrow the result to the rest.
 *
 * **Details**
 *
 * `wrap` returns a derived atom, memoized per atom. A claimed failure is
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
 * The derived atom isn't serializable, so loaders start the atom itself.
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
	 * read throws them to the boundary that claims them, typed without them.
	 */
	readonly wrap: <A, E>(
		atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
	) => Atom.Atom<AsyncResult.AsyncResult<A, Unclaimed<E, Tags>>>;
}
