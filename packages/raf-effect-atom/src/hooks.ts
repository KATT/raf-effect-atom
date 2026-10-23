/**
 * The read hook for atoms started by loaders and streamed from the server.
 *
 * @stability unstable
 * @since 0.1.0
 */
"use client";

import { RegistryContext, useAtomSuspense } from "@effect/atom-react";
import * as Effect from "effect/Effect";
import * as Predicate from "effect/Predicate";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import type { ClaimedResult, ErrorBoundaryClaims } from "effect-atom-boundary";
import * as React from "react";

import { hydrated } from "./hydration.ts";
import { isDevelopment } from "./internal/development.ts";
import * as Leases from "./internal/leases.ts";
import * as Pending from "./internal/pending.ts";
import * as Registry from "./internal/registry.ts";
import type { SettledResult } from "./loader.ts";
import { isRequestRegistry } from "./request-registry.ts";

/**
 * Reads an `AsyncResult` atom through React Suspense: a result streamed from
 * the server, a hydrated one, or one a loader started.
 *
 * **When to use**
 *
 * Use for every atom a loader starts or the server renders. Pass the claims
 * of an `effect-atom-boundary` boundary to throw its errors to it.
 *
 * **Details**
 *
 * - A result the server was still loading when it dehydrated is awaited
 *   instead of started, so the browser doesn't request it a second time.
 * - The atom is read through `hydrated`, so a hydrated result is kept.
 * - Once the component mounts, the loader's lease ends and the component
 *   keeps the atom mounted.
 * - Without claims, the settled result is returned, typed failures
 *   included. With claims, `claims.claim` throws a claimed failure to its
 *   boundary and returns the rest, typed without the claimed errors.
 * - While a failed atom refreshes, such as after a boundary's `reset`, the
 *   read suspends instead of returning the old failure again.
 *
 * **Gotchas**
 *
 * During server rendering, the registry must be a request registry (see
 * `RequestRegistry.make`), or a module-level registry would share results
 * between requests: in development, the hook throws without one.
 *
 * **Example**
 *
 * ```tsx
 * import { AsyncResult } from "effect/reactivity"
 * import { useAtomResult } from "raf-effect-atom"
 *
 * function IssueTitle(props: { readonly id: number }) {
 *   const result = useAtomResult(issue(props.id), useAuthBoundary())
 *   return AsyncResult.isSuccess(result) ? <h1>{result.value.title}</h1> : null
 * }
 * ```
 *
 * @see {@link hydrated} for reading hydrated atoms with Atom's own hooks
 *
 * @stability unstable
 * @category hooks
 * @since 0.1.0
 */
export function useAtomResult<A, E>(
	atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
): SettledResult<A, E>;
export function useAtomResult<A, E, Tags extends string>(
	atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
	claims: ErrorBoundaryClaims<Tags>,
): ClaimedResult<A, E, Tags>;
export function useAtomResult<A, E>(
	atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
	claims?: ErrorBoundaryClaims<string>,
): ClaimedResult<A, E, string> | SettledResult<A, E> {
	const registry = React.useContext(RegistryContext);
	if (
		Registry.isServer() &&
		!isRequestRegistry(registry) &&
		Effect.runSync(isDevelopment)
	) {
		throw new Error(
			"raf-effect-atom: useAtomResult rendered on the server without a request registry, so results would be shared between requests. Provide RequestRegistry.make() through RegistryContext, as the framework integrations do.",
		);
	}
	const target = hydrated(atom);
	const key = Leases.keyOf(target);
	const streamed = Predicate.isString(key)
		? Pending.get(registry, key)
		: undefined;
	if (streamed !== undefined) {
		React.use(streamed);
	}
	const current = registry.get(target);
	const result = useAtomSuspense(target, {
		includeFailure: true,
		suspendOnWaiting: AsyncResult.isFailure(current) && current.waiting,
	});
	React.useEffect(() => {
		Leases.release(registry, target);
	}, [registry, target]);
	return claims === undefined ? result : claims.claim(atom, registry, result);
}
