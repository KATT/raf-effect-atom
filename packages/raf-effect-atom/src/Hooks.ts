/**
 * The read hook for atoms started by loaders and streamed from the server.
 *
 * @stability unstable
 * @since 0.1.0
 */
"use client";

import { RegistryContext, useAtomSuspense } from "@effect/atom-react";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Predicate from "effect/Predicate";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import * as React from "react";

import { hydrated } from "./Hydration.ts";
import { isDevelopment } from "./internal/development.ts";
import * as Leases from "./internal/leases.ts";
import * as Pending from "./internal/pending.ts";
import * as Registry from "./internal/registry.ts";
import * as Waterfalls from "./internal/waterfalls.ts";
import type { SettledResult } from "./Loader.ts";
import { isRequestRegistry } from "./RequestRegistry.ts";

// Bundlers replace `process.env.NODE_ENV` at build time. Declared here, so
// apps that type-check this source don't need Node's types.
declare const process: {
	readonly env: { readonly NODE_ENV?: string | undefined };
};

/**
 * The atom the loader started and the server sent: the first serializable
 * atom in `atom`'s `initialValueTarget` chain, starting with `atom`. An
 * AtomRpc query is serializable itself, though it points at an inner atom.
 */
const sourceOf = (atom: Atom.Atom<unknown>): Atom.Atom<unknown> => {
	for (
		let target: Atom.Atom<unknown> | undefined = atom;
		target !== undefined;
		target = target.initialValueTarget
	) {
		if (Atom.isSerializable(target)) {
			return target;
		}
	}
	return atom;
};

/**
 * Reads an `AsyncResult` atom through React Suspense: a result streamed from
 * the server, a hydrated one, or one a loader started.
 *
 * **When to use**
 *
 * Use for every atom a loader starts or the server renders, or for an atom
 * derived from one with `initialValueTarget` pointing at it, such as an error
 * boundary's wrapper.
 *
 * **Details**
 *
 * - A result the server was still loading when it dehydrated is awaited
 *   instead of started, so the browser doesn't request it a second time.
 * - The atom is read through `hydrated`, so a hydrated result is kept.
 * - Once the component mounts, the loader's lease ends and the component
 *   keeps the atom mounted.
 * - A derived atom is read through the first serializable atom its
 *   `initialValueTarget` chain points at: that one is awaited, hydrated and
 *   released, so the derived atom doesn't request it again.
 * - The settled result is returned, typed failures included. A defect is
 *   thrown to the error boundaries above.
 * - While a failed atom refreshes, such as after a boundary's `reset`, the
 *   read suspends instead of returning the old failure again.
 *
 * **Gotchas**
 *
 * A read of an atom that nothing started starts it, and its request waits
 * for the render: a request waterfall. In development, the read reports it
 * as `WaterfallDetection` says, by default with a warning. Start the atom in
 * a loader, a server component or the event handler that shows it, or read
 * it through `useWaterfall` when only the render knows its input.
 *
 * During server rendering, the registry must be a request registry (see
 * `RequestRegistry.make`), or a module-level registry would share results
 * between requests: in development, the hook throws without one.
 *
 * `Atom.transform`'s `initialValueTarget` option points at the end of the
 * target's own chain, which for an AtomRpc query with `reactivityKeys` is an
 * inner atom with no serialization key. A derived atom read here sets
 * `initialValueTarget` to its source itself, as an error boundary's
 * wrapper does, or it requests the source again after hydration.
 *
 * **Example**
 *
 * ```tsx
 * import { AsyncResult } from "effect/reactivity"
 * import { useAtomResult } from "raf-effect-atom"
 *
 * function IssueTitle(props: { readonly id: number }) {
 *   const result = useAtomResult(issue(props.id))
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
export const useAtomResult = <A, E>(
	atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
): SettledResult<A, E> => {
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
	const target = sourceOf(atom);
	const source = hydrated(target);
	const read = target === atom ? hydrated(atom) : atom;
	const key = Leases.keyOf(source);
	const streamed = Predicate.isString(key)
		? Pending.get(registry, key)
		: undefined;
	if (streamed !== undefined) {
		React.use(streamed);
	}
	if (process.env.NODE_ENV !== "production") {
		Waterfalls.check(registry, source, React.use(Waterfalls.ModeContext));
	}
	if (read !== source) {
		// Builds the source's node from the hydrated copy, before the derived
		// atom builds it from the source and requests it again.
		registry.get(source);
	}
	const current = registry.get(read);
	const result = useAtomSuspense(read, {
		includeFailure: true,
		suspendOnWaiting: AsyncResult.isFailure(current) && current.waiting,
	});
	React.useEffect(() => {
		Leases.release(registry, source);
	}, [registry, source]);
	if (
		AsyncResult.isFailure(result) &&
		Option.isNone(Cause.findErrorOption(result.cause))
	) {
		throw Cause.squash(result.cause);
	}
	return result;
};
