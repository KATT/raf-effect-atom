/**
 * The read hooks for atoms started by loaders and streamed from the server.
 *
 * @stability unstable
 * @since 0.1.0
 */
"use client";

import {
	RegistryContext,
	useAtomSuspense,
	useAtomValue,
} from "@effect/atom-react";
import * as Cause from "effect/Cause";
import * as Option from "effect/Option";
import * as Predicate from "effect/Predicate";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import * as React from "react";

import type { ErrorOf, Handle, Source, SuccessOf } from "./handle.ts";
import { hydrated } from "./Hydration.ts";
import * as Handles from "./internal/handles.ts";
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
 * A source with the same arguments and success type as `S`, and any error:
 * the sources whose handles `S` reads, such as the source a derived `S`
 * points at.
 */
type Readable<S> = S extends (
	...args: infer Args
) => Atom.Atom<AsyncResult.AsyncResult<infer A, infer _E>>
	? (...args: Args) => Atom.Atom<AsyncResult.AsyncResult<A, unknown>>
	: S extends Atom.Atom<AsyncResult.AsyncResult<infer A, infer _E>>
		? Atom.Atom<AsyncResult.AsyncResult<A, unknown>>
		: never;

/** The atoms a read of a handle uses. */
interface Targets<A> {
	/** The lease's key: `started`'s serialization key, or `started`. */
	readonly key: Atom.Atom<unknown> | string;
	/** The atom the component reads: `started`, or a derived atom pointing at it. */
	readonly read: A;
	/** The hydrated copy of the serializable atom a loader started. */
	readonly started: Atom.Atom<unknown>;
}

const targetsOf = <A extends Atom.Atom<unknown>>(
	atom: A,
	handle: { readonly key?: string | undefined },
	hook: string,
): Targets<A> => {
	const target = Handles.sourceOf(atom);
	const started = hydrated(target);
	const read = target === atom ? hydrated(atom) : atom;
	const key = Leases.keyOf(started);
	if (
		process.env.NODE_ENV !== "production" &&
		handle.key !== undefined &&
		Predicate.isString(key) &&
		handle.key !== key
	) {
		throw new Error(
			`raf-effect-atom: ${hook} read the handle of ${handle.key} through a source that makes ${key}. Read a handle through the source that made it.`,
		);
	}
	return { key, read, started };
};

/**
 * Reads a handle through React Suspense, through the source that made it: a
 * result streamed from the server, a hydrated one, or one a loader started.
 *
 * **When to use**
 *
 * Use in the component a loader, a server component or `useWaterfall` gave
 * the handle to. The source can be the one the verb started, or one derived
 * from it whose atoms point at its atoms with `initialValueTarget`. To send
 * some failures to an error boundary, pass the result to the boundary's hook,
 * such as `useIssueBoundary(useAtomResult(issue, handle))`.
 *
 * **Details**
 *
 * - The atom is `source(...handle.args)`, or `source` itself for an atom.
 *   In development, the read throws when the atom it hydrates has another
 *   serialization key than the handle's: the handle came from another
 *   source.
 * - A handle from `ensure` or `fetch` renders without suspending, unless
 *   the registry dropped the result since; one from `prefetch` or
 *   `useWaterfall` suspends until the result settles. The registry is the
 *   source of truth either way: the read follows refreshes and mutations.
 * - A result the server was still loading when it dehydrated is awaited
 *   instead of started, so the browser doesn't request it a second time.
 * - The atom is read through `hydrated`, so a hydrated result is kept.
 * - Once the component mounts, the loader's lease ends and the component
 *   keeps the atom mounted. A loader that starts the atom again while it's
 *   mounted takes no lease, so the atom goes idle when the component unmounts.
 * - A derived atom is read through the first serializable atom its
 *   `initialValueTarget` chain points at: that one is awaited, hydrated and
 *   released, so the derived atom doesn't request it again.
 * - The settled result is returned, typed failures included. A defect is
 *   thrown to the error boundaries above. With no typed failures, it's typed
 *   as a success.
 * - While a failed atom refreshes, such as after a boundary's `reset`, the
 *   read suspends instead of returning the old failure again.
 *
 * **Gotchas**
 *
 * A read of an atom that nothing started, such as one whose loader result the
 * registry dropped, starts it, and its request waits for the render: a
 * request waterfall. In development, the read reports it as
 * `WaterfallDetection` says, by default with a warning. Start the atom in a
 * loader or a server component, with the state that picks it in the URL,
 * and pass its handle down. For state that can't be in the URL, start it in
 * the event handler that changes the state, or make its handle with
 * `useWaterfall` when only the render knows its input.
 *
 * Two sources with the same arguments and success type take each other's
 * handles as far as the types go; the development check catches it.
 *
 * During server rendering, the registry must be a request registry (see
 * `RequestRegistry.make`), or a module-level registry would share results
 * between requests: in development, the hook throws without one.
 *
 * `Atom.transform`'s `initialValueTarget` option points at the end of the
 * target's own chain, which for an AtomRpc query with `reactivityKeys` is an
 * inner atom with no serialization key. A derived atom read here sets
 * `initialValueTarget` to its source itself, or it requests the source again
 * after hydration.
 *
 * **Example**
 *
 * ```tsx
 * import { AsyncResult } from "effect/reactivity"
 * import { type Handle, useAtomResult } from "raf-effect-atom"
 *
 * function IssueTitle(props: { readonly issue: Handle<typeof issue> }) {
 *   const result = useAtomResult(issue, props.issue)
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
export const useAtomResult = <S extends Source>(
	source: S,
	handle: NoInfer<Handle<Readable<S>>>,
): [ErrorOf<S>] extends [never]
	? AsyncResult.Success<SuccessOf<S>, never>
	: SettledResult<SuccessOf<S>, ErrorOf<S>> => {
	const registry = React.useContext(RegistryContext);
	const atom = Handles.atomOf(source, handle.args);
	Registry.requireRequestRegistry(registry, "useAtomResult");
	if (handle.inBrowser === true && isRequestRegistry(registry)) {
		throw new Error(
			`raf-effect-atom: ${String(atom)} starts in the browser (Loader.prefetchInBrowser), so the server renders the nearest Suspense boundary's fallback, and the browser renders the boundary.`,
		);
	}
	const targets = targetsOf(atom, handle, "useAtomResult");
	const { read, started } = targets;
	const streamed = Predicate.isString(targets.key)
		? Pending.stream(registry, targets.key)
		: undefined;
	if (streamed !== undefined) {
		React.use(streamed);
	}
	if (process.env.NODE_ENV !== "production" && handle.inBrowser !== true) {
		Waterfalls.check(registry, started, React.use(Waterfalls.ModeContext));
	}
	if (read !== started) {
		// Builds the source's node from the hydrated copy, before the derived
		// atom builds it from the source and requests it again.
		registry.get(started);
	}
	const current = registry.get(read);
	const result = useAtomSuspense(read, {
		includeFailure: true,
		suspendOnWaiting: AsyncResult.isFailure(current) && current.waiting,
	});
	React.useEffect(() => Leases.hold(registry, started), [registry, started]);
	if (
		AsyncResult.isFailure(result) &&
		Option.isNone(Cause.findErrorOption(result.cause))
	) {
		throw Cause.squash(result.cause);
	}
	// SAFETY: `source` makes atoms of its own result type, and a failure with
	// no typed error was thrown above, so when its error is `never` the
	// result is a success.
	return result as [ErrorOf<S>] extends [never]
		? AsyncResult.Success<SuccessOf<S>, never>
		: SettledResult<SuccessOf<S>, ErrorOf<S>>;
};

/** What a read shows while it can't read the atom yet. */
const loading = Atom.make(AsyncResult.initial<never, never>(true));

/**
 * Reads a handle without React Suspense, through the source that made it,
 * and returns the atom's current result as it is.
 *
 * **When to use**
 *
 * Use where a component renders every state of the read itself: its loading
 * state, a failure that stays on the page while the atom refreshes, or a
 * defect. Otherwise prefer `useAtomResult`, which suspends until the result
 * settles and sends defects to the error boundaries above.
 *
 * **Details**
 *
 * - It reads the atom as `useAtomResult` does: through `hydrated`, through
 *   the serializable atom a derived source points at, and with the same
 *   development checks on the handle's key and on request waterfalls.
 * - It returns `Initial` while the atom loads, and while a result the server
 *   was still loading streams in. It doesn't read the atom until the stream
 *   settles, so the browser doesn't request it a second time.
 * - A failure is returned as it is, `waiting` while the atom refreshes, and
 *   so is a defect.
 * - Once the component has subscribed to the atom, the loader's lease ends
 *   and the component keeps the atom mounted. A loader that starts the atom
 *   again while it's mounted takes no lease, so the atom goes idle when the
 *   component unmounts.
 * - A handle `Loader.prefetchInBrowser` returned on the server reads as
 *   `Initial` there, without starting the atom; the browser's read starts
 *   it.
 *
 * **Gotchas**
 *
 * The server renders what the read returns, `Initial` for a result still
 * loading, and the browser's first render has to match it: render the same
 * loading state for every `Initial`.
 *
 * During server rendering, the registry must be a request registry (see
 * `RequestRegistry.make`): in development, the hook throws without one.
 *
 * **Example**
 *
 * ```tsx
 * import { AsyncResult } from "effect/reactivity"
 * import { type Handle, useHandleValue } from "raf-effect-atom"
 *
 * function IssueTitle(props: { readonly issue: Handle<typeof issue> }) {
 *   const result = useHandleValue(issue, props.issue)
 *   return AsyncResult.isSuccess(result) ? <h1>{result.value.title}</h1> : <p>Loading…</p>
 * }
 * ```
 *
 * @see {@link useAtomResult} for a read that suspends until the result settles
 *
 * @stability unstable
 * @category hooks
 * @since 0.3.1
 */
export const useHandleValue = <S extends Source>(
	source: S,
	handle: NoInfer<Handle<Readable<S>>>,
): AsyncResult.AsyncResult<SuccessOf<S>, ErrorOf<S>> => {
	const registry = React.useContext(RegistryContext);
	const atom = Handles.atomOf(source, handle.args);
	Registry.requireRequestRegistry(registry, "useHandleValue");
	const targets = targetsOf(atom, handle, "useHandleValue");
	const { started } = targets;
	const streamed = Predicate.isString(targets.key)
		? Pending.get(registry, targets.key)
		: undefined;
	const [, settled] = React.useReducer((count: number) => count + 1, 0);
	React.useEffect(() => {
		if (streamed === undefined) {
			return;
		}
		let active = true;
		const rerender = () => {
			if (active) {
				settled();
			}
		};
		streamed.then(rerender, rerender);
		return () => {
			active = false;
		};
	}, [streamed]);
	const waiting =
		streamed !== undefined ||
		(handle.inBrowser === true && isRequestRegistry(registry));
	if (!waiting) {
		if (process.env.NODE_ENV !== "production" && handle.inBrowser !== true) {
			Waterfalls.check(registry, started, React.use(Waterfalls.ModeContext));
		}
		if (targets.read !== started) {
			// Builds the source's node from the hydrated copy, before the derived
			// atom builds it from the source and requests it again.
			registry.get(started);
		}
	}
	const result = useAtomValue(waiting ? loading : targets.read);
	React.useEffect(() => {
		if (!waiting) {
			return Leases.hold(registry, started);
		}
		return undefined;
	}, [registry, started, waiting]);
	// SAFETY: `source` makes atoms of its own result type, and `loading` is an
	// `Initial`, which every result type includes.
	return result as AsyncResult.AsyncResult<SuccessOf<S>, ErrorOf<S>>;
};
