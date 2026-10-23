/**
 * The read hook for typed error boundaries: `useAtomSuspense` plus the
 * claiming step, so a failure throws to the boundary that claims it.
 *
 * @stability unstable
 * @since 0.1.0
 */
"use client";

import { RegistryContext, useAtomSuspense } from "@effect/atom-react";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import * as React from "react";

import {
	claim,
	type ClaimedResult,
	type ErrorBoundaryClaims,
} from "./Claim.ts";

/**
 * Reads an `AsyncResult` atom through React Suspense and throws its typed
 * failures to the error boundaries above.
 *
 * **When to use**
 *
 * Use under an `AtomErrorBoundary` without claims, or with the claims of a
 * `createErrorBoundary` hook to get a result typed without the errors the
 * boundaries above claim.
 *
 * **Details**
 *
 * The read suspends like `useAtomSuspense`. With claims, a claimed failure
 * throws to the nearest boundary that claims it and any other result is
 * returned. Without claims, every typed failure throws. While a failed atom
 * refreshes, such as after a boundary's `reset`, the read suspends instead of
 * throwing the old failure again.
 *
 * **Gotchas**
 *
 * A defect or an interruption isn't a typed error: it throws
 * `Cause.squash(cause)` to the app's own error boundary.
 *
 * @see {@link claim} for the claiming step without the hook
 *
 * @stability unstable
 * @category hooks
 * @since 0.1.0
 */
export function useAtomResult<A, E>(
	atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
): AsyncResult.Success<A, E>;
export function useAtomResult<A, E, Tags extends string>(
	atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
	claims: ErrorBoundaryClaims<Tags>,
): ClaimedResult<A, E, Tags>;
export function useAtomResult<A, E>(
	atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
	claims?: ErrorBoundaryClaims<string>,
): ClaimedResult<A, E, string> | AsyncResult.Success<A, E> {
	const registry = React.useContext(RegistryContext);
	const current = registry.get(atom);
	const result = useAtomSuspense(atom, {
		includeFailure: true,
		suspendOnWaiting: AsyncResult.isFailure(current) && current.waiting,
	});
	return claims === undefined
		? claim(atom, registry, result)
		: claims.claim(atom, registry, result);
}
