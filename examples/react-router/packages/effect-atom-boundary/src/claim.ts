/**
 * The claiming step of typed error boundaries. A boundary claims errors by
 * `_tag`; its hook takes a read's result, throws the claimed failures to the
 * boundary that claims them, and returns the result typed without them.
 *
 * @stability unstable
 * @since 0.1.0
 */
import type * as AsyncResult from "effect/reactivity/AsyncResult";
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
 * returns the result typed without them.
 *
 * **When to use**
 *
 * Wrap each read under the boundary in it, such as
 * `useIssueBoundary(useAtomResult(issue, handle))`, to throw the claimed
 * failures to their boundaries and narrow the result to the rest.
 *
 * **Details**
 *
 * A failure whose error has a claimed `_tag` is thrown as the error itself,
 * so the nearest boundary that claims it catches it. A failure with no typed
 * error, a defect, is thrown too, to the error boundaries above. Any other
 * result is returned as it is. It takes any `AsyncResult`, from a read that
 * returns typed failures and suspends while a failed atom refreshes:
 * `raf-effect-atom`'s `useAtomResult`, or `useAtomSuspense` with
 * `includeFailure: true` and `suspendOnWaiting: true`.
 *
 * **Gotchas**
 *
 * It's a hook, and it throws outside its boundary. It throws a claimed
 * failure whether or not the atom is refreshing, so a read that returns the
 * old failure while a `reset` refreshes it, such as `useAtomValue`, throws
 * it to the boundary again, and the handler stays after the refresh. A read
 * that throws every failure itself, such as `useAtomSuspense` without
 * `includeFailure`, throws before the hook sees the result.
 *
 * @stability unstable
 * @category models
 * @since 0.1.0
 */
export interface UseErrorBoundary<Tags extends string> {
	<R extends AsyncResult.AsyncResult<unknown, unknown>>(
		result: R,
	): UnclaimedResult<R, Tags>;
}
