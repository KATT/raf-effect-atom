/**
 * The claiming step of typed error boundaries. A boundary claims errors by
 * `_tag`; `claim` takes an atom's settled `AsyncResult`, throws a claimed
 * failure to the boundary that claims it, and returns anything else typed
 * without the claimed errors. `useAtomResult` is `claim` inside a hook.
 *
 * @stability unstable
 * @since 0.1.0
 */
import * as Cause from "effect/Cause";
import * as Option from "effect/Option";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type * as Types from "effect/Types";

import * as FailedReads from "./internal/failedReads.ts";

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
 * A settled `AsyncResult`, as `useAtomSuspense` returns it with
 * `includeFailure`.
 *
 * @stability unstable
 * @category models
 * @since 0.1.0
 */
export type SettledResult<A, E> =
	| AsyncResult.Failure<A, E>
	| AsyncResult.Success<A, E>;

/**
 * An atom's settled result without the errors whose `_tag` is in `Tags`.
 *
 * @stability unstable
 * @category models
 * @since 0.1.0
 */
export type ClaimedResult<A, E, Tags extends string> = SettledResult<
	A,
	Exclude<E, { readonly _tag: Tags }>
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
 * Use with `useAtomResult` or `claim` to throw the claimed failures to their
 * boundaries and narrow the result to the rest.
 *
 * **Details**
 *
 * The claims carry `claim` as a method, so a read hook in another package can
 * hand its result to a boundary without importing this package at runtime.
 *
 * @see {@link claim} for the standalone claiming step
 *
 * @stability unstable
 * @category models
 * @since 0.1.0
 */
export interface ErrorBoundaryClaims<
	Tags extends string,
> extends Variance<Tags> {
	/**
	 * Throws a claimed failure to the boundary that claims it, and returns any
	 * other result typed without the claimed errors.
	 */
	readonly claim: <A, E>(
		atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
		registry: AtomRegistry.AtomRegistry,
		result: SettledResult<A, E>,
	) => ClaimedResult<A, E, Tags>;
	/** Returns whether this boundary or one above it claims `error`. */
	readonly owns: (error: unknown) => boolean;
}

/**
 * Hands an atom's settled result to the boundaries above: a typed failure
 * the claims own is thrown to the nearest boundary that claims it, and any
 * other result is returned typed without the claimed errors.
 *
 * **When to use**
 *
 * Use in a read hook of your own, with the registry and the result it read,
 * to get the same claiming as `useAtomResult`.
 *
 * **Details**
 *
 * Without claims, every typed failure is thrown, for an
 * `AtomErrorBoundary` to catch. A thrown error is recorded with its atom and
 * registry, so the boundary that catches it refreshes that atom on `reset`.
 *
 * **Gotchas**
 *
 * A defect or an interruption isn't a typed error: it throws
 * `Cause.squash(cause)` to the app's own error boundary, as `useAtomSuspense`
 * does.
 *
 * @see {@link ErrorBoundaryClaims} for the claims a boundary's hook returns
 *
 * @stability unstable
 * @category error handling
 * @since 0.1.0
 */
export function claim<A, E>(
	atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
	registry: AtomRegistry.AtomRegistry,
	result: SettledResult<A, E>,
): AsyncResult.Success<A, E>;
export function claim<A, E, Tags extends string>(
	atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
	registry: AtomRegistry.AtomRegistry,
	result: SettledResult<A, E>,
	claims: ErrorBoundaryClaims<Tags>,
): ClaimedResult<A, E, Tags>;
export function claim<A, E>(
	atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
	registry: AtomRegistry.AtomRegistry,
	result: SettledResult<A, E>,
	claims?: ErrorBoundaryClaims<string>,
): SettledResult<A, E> {
	if (AsyncResult.isSuccess(result)) {
		return result;
	}
	const error = Cause.findErrorOption(result.cause);
	if (Option.isNone(error)) {
		throw Cause.squash(result.cause);
	}
	if (claims !== undefined && !claims.owns(error.value)) {
		return result;
	}
	FailedReads.record(error.value, { atom, registry });
	throw error.value;
}
