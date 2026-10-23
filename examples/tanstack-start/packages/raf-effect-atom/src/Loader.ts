/**
 * Starts atoms from route loaders, before anything renders, so nothing
 * waterfalls.
 *
 * Each verb takes a source, an atom family or an `AsyncResult` atom, with its
 * arguments. It starts the atom in the registry, takes a lease on it, so the
 * registry's idle TTL can't evict it before the route renders and
 * `useAtomResult` takes it over, and returns its handle for the component
 * that reads it:
 *
 * | Verb       | Starts the atom                 | Waits                         | Has a value already   |
 * | ---------- | ------------------------------- | ----------------------------- | --------------------- |
 * | `prefetch` | if it isn't in the registry     | never                         | leaves it alone       |
 * | `ensure`   | if it isn't in the registry     | only while it's `Initial`     | returns it at once    |
 * | `fetch`    | if it isn't, or refreshes it    | until the new result settles  | refreshes, then waits |
 *
 * Typed failures don't reject: `ensure` and `fetch` settle on them, and
 * `result` returns the settled `AsyncResult`, so a loader can redirect on a
 * tag and otherwise let a boundary render the failure. Only defects and
 * interruptions reject.
 *
 * The verbs are Effects that need the `AtomRegistry`; `make` gives the same
 * verbs as Promises over one registry, for loaders that are async functions.
 *
 * @stability unstable
 * @since 0.1.0
 */
import * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Predicate from "effect/Predicate";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";

import type {
	ArgsOf,
	ErrorOf,
	Handle,
	LoadedHandle,
	Source,
	SuccessOf,
} from "./Handle.ts";
import { hydrated } from "./Hydration.ts";
import { isDevelopment } from "./internal/development.ts";
import * as Handles from "./internal/handles.ts";
import * as Leases from "./internal/leases.ts";
import { isRequestRegistry } from "./RequestRegistry.ts";

/**
 * A settled `AsyncResult`: what `ensure` and `fetch` return.
 *
 * @stability unstable
 * @category models
 * @since 0.1.0
 */
export type SettledResult<A, E> =
	| AsyncResult.Failure<A, E>
	| AsyncResult.Success<A, E>;

/**
 * How long a loader's lease keeps an atom mounted when no component takes it
 * over. Default 30 seconds.
 *
 * **Details**
 *
 * A lease ends when `useAtomResult` mounts the atom, or when this time has
 * passed, after which the registry's idle TTL applies as usual. On a request
 * registry, leases last until the registry is disposed.
 *
 * @stability unstable
 * @category references
 * @since 0.1.0
 */
export const LeaseTTL: Context.Reference<Duration.Duration> =
	Context.Reference<Duration.Duration>("raf-effect-atom/Loader/LeaseTTL", {
		defaultValue: () => Duration.seconds(30),
	});

const start = Effect.fnUntraced(function* <A, E>(
	atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
) {
	const registry = yield* AtomRegistry.AtomRegistry;
	const request = isRequestRegistry(registry);
	if (request && !Atom.isSerializable(atom) && (yield* isDevelopment)) {
		return yield* Effect.die(
			new Error(
				`raf-effect-atom: a loader started ${String(atom)}, which isn't serializable, so the browser would request it again. Give it a serialization key, such as AtomRpc's serializationKey option.`,
			),
		);
	}
	const ttl = request ? undefined : Duration.toMillis(yield* LeaseTTL);
	const target = hydrated(atom);
	const key = Leases.keyOf(target);
	const existed =
		registry.getNodes().has(key) ||
		(Predicate.isString(key) && registry.preloadedSerializable.has(key));
	Leases.take(registry, target, ttl);
	return { existed, registry, request, target };
});

const isSettled = <A, E>(
	result: AsyncResult.AsyncResult<A, E>,
): result is SettledResult<A, E> =>
	AsyncResult.isNotInitial(result) && !result.waiting;

const settled = <A, E>(
	registry: AtomRegistry.AtomRegistry,
	atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
	isDone: (
		result: AsyncResult.AsyncResult<A, E>,
	) => result is SettledResult<A, E>,
): Effect.Effect<SettledResult<A, E>> =>
	Effect.callback<SettledResult<A, E>>((resume) => {
		const current = registry.get(atom);
		if (isDone(current)) {
			resume(Effect.succeed(current));
			return;
		}
		const cancel = registry.subscribe(atom, (value) => {
			if (isDone(value)) {
				cancel();
				resume(Effect.succeed(value));
			}
		});
		return Effect.sync(cancel);
	}).pipe(Effect.flatMap(rejectDefects));

const rejectDefects = <A, E>(
	result: SettledResult<A, E>,
): Effect.Effect<SettledResult<A, E>> => {
	if (
		AsyncResult.isFailure(result) &&
		Option.isNone(Cause.findErrorOption(result.cause))
	) {
		// SAFETY: a cause without a typed error holds only defects and
		// interruptions.
		const defects = result.cause as Cause.Cause<never>;
		return Effect.failCause(defects);
	}
	return Effect.succeed(result);
};

/**
 * Starts a source's atom without waiting for it, and returns its handle.
 *
 * **When to use**
 *
 * Use for data the route needs but its loader doesn't: it streams in while
 * the route renders.
 *
 * **Details**
 *
 * Starts the atom if it isn't in the registry, and leaves it alone if it is.
 * Takes a lease either way. The component that reads the handle suspends
 * until the result settles.
 *
 * **Example**
 *
 * ```ts
 * import { Effect } from "effect"
 * import { Loader } from "raf-effect-atom"
 *
 * const program = Loader.prefetch(commentPage, issueId, 0)
 * ```
 *
 * @stability unstable
 * @category verbs
 * @since 0.1.0
 */
export const prefetch = <S extends Source>(
	source: S,
	...args: ArgsOf<S>
): Effect.Effect<Handle<S>, never, AtomRegistry.AtomRegistry> =>
	Effect.gen(function* () {
		const atom = Handles.atomOf(source, args);
		yield* start(atom);
		return Handles.make<S>(args, atom);
	});

const loaded = <S extends Source>(
	args: ArgsOf<S>,
	atom: Atom.Atom<unknown>,
	result: SettledResult<unknown, unknown>,
): LoadedHandle<S> => {
	const handle = Handles.loaded<S>(args, atom);
	results.set(handle, result);
	return handle;
};

/**
 * Starts a source's atom, waits only while it has no result, and returns a
 * handle whose reader renders without suspending.
 *
 * **When to use**
 *
 * Use when the loader needs the result, such as to redirect on a tag, or
 * when the route shouldn't render without it.
 *
 * **Details**
 *
 * An atom with a result returns at once, without refetching. On a request
 * registry, it also waits out a refresh in flight, so the server never
 * renders a result that's about to change. A typed failure settles it like
 * a success: `result` returns it. A defect or an interruption fails the
 * Effect.
 *
 * **Example**
 *
 * ```ts
 * import { Effect } from "effect"
 * import { AsyncResult } from "effect/reactivity"
 * import { Loader } from "raf-effect-atom"
 *
 * const program = Effect.gen(function* () {
 *   const handle = yield* Loader.ensure(issue, 1)
 *   const result = Loader.result(handle)
 *   return AsyncResult.isSuccess(result) ? result.value.title : "missing"
 * })
 * ```
 *
 * @stability unstable
 * @category verbs
 * @since 0.1.0
 */
export const ensure = <S extends Source>(
	source: S,
	...args: ArgsOf<S>
): Effect.Effect<LoadedHandle<S>, never, AtomRegistry.AtomRegistry> =>
	Effect.gen(function* () {
		const atom = Handles.atomOf(source, args);
		const started = yield* start(atom);
		const result = yield* settled(
			started.registry,
			started.target,
			started.request ? isSettled : AsyncResult.isNotInitial,
		);
		return loaded<S>(args, atom, result);
	});

/**
 * Starts a source's atom, or refreshes it if it has a result, waits for the
 * new result to settle, and returns a handle whose reader renders without
 * suspending.
 *
 * **When to use**
 *
 * Use when the loader must not see a result from before it ran, such as
 * after a mutation.
 *
 * **Details**
 *
 * Waits until the result settles and isn't refreshing. A typed failure
 * settles it like a success: `result` returns it. A defect or an
 * interruption fails the Effect.
 *
 * @stability unstable
 * @category verbs
 * @since 0.1.0
 */
export const fetch = <S extends Source>(
	source: S,
	...args: ArgsOf<S>
): Effect.Effect<LoadedHandle<S>, never, AtomRegistry.AtomRegistry> =>
	Effect.gen(function* () {
		const atom = Handles.atomOf(source, args);
		const started = yield* start(atom);
		const { registry, target } = started;
		if (started.existed && isSettled(registry.get(target))) {
			// An `Atom.family` makes a member again once the garbage collector
			// takes it, such as an AtomRpc query: its refresh reaches inner atoms
			// the registry doesn't run, so refresh the atom its node runs.
			const node = registry.getNodes().get(Leases.keyOf(target));
			registry.refresh(node?.atom ?? target);
		}
		const result = yield* settled(registry, target, isSettled);
		return loaded<S>(args, atom, result);
	});

// Keyed by the handle object, which a serializer copies: only the code that
// ran the verb holds this one.
const results = new WeakMap<object, SettledResult<unknown, unknown>>();

/**
 * Returns the settled result `ensure` or `fetch` waited for.
 *
 * **When to use**
 *
 * Use in the loader that ran the verb, to branch on the result: redirect on
 * a tag, or build another atom's arguments from it. Components read the
 * handle with `useAtomResult`, which follows the registry.
 *
 * **Gotchas**
 *
 * Only the handle object the verb returned has it: a handle that crossed
 * the network, as loader data or a server component's prop, is a copy, and
 * this throws for it.
 *
 * **Example**
 *
 * ```ts
 * import { AsyncResult } from "effect/reactivity"
 * import { Loader } from "raf-effect-atom"
 *
 * const handle = await atoms.ensure(issue, id)
 * const error = AsyncResult.error(Loader.result(handle))
 * ```
 *
 * @stability unstable
 * @category getters
 * @since 0.1.0
 */
export const result = <S extends Source>(
	handle: LoadedHandle<S>,
): SettledResult<SuccessOf<S>, ErrorOf<S>> => {
	const settledResult = results.get(handle);
	if (settledResult === undefined) {
		throw new Error(
			"raf-effect-atom: Loader.result got a handle that no ensure or fetch returned here. Only the code that ran the verb has its result: a handle that crossed the network is a copy. Read it with useAtomResult instead.",
		);
	}
	// SAFETY: the verb that made `handle` stored its source's settled result.
	return settledResult as SettledResult<SuccessOf<S>, ErrorOf<S>>;
};

/**
 * The loader verbs as Promises over one registry, as the framework
 * integrations put them on the router context.
 *
 * @stability unstable
 * @category models
 * @since 0.1.0
 */
export interface Loader {
	/** {@link ensure}, as a Promise that rejects only on a defect. */
	readonly ensure: <S extends Source>(
		source: S,
		...args: ArgsOf<S>
	) => Promise<LoadedHandle<S>>;
	/** {@link fetch}, as a Promise that rejects only on a defect. */
	readonly fetch: <S extends Source>(
		source: S,
		...args: ArgsOf<S>
	) => Promise<LoadedHandle<S>>;
	/** {@link prefetch}, run at once. */
	readonly prefetch: <S extends Source>(
		source: S,
		...args: ArgsOf<S>
	) => Handle<S>;
}

/**
 * Creates the Promise verbs over one registry.
 *
 * **When to use**
 *
 * Use in a framework integration, in loaders that are async functions, or
 * in an event handler that starts an atom before the state change that
 * renders its reader, for state that can't be in the URL, such as a
 * search-as-you-type query. In Effect code, use
 * the verbs directly with the `AtomRegistry` provided.
 *
 * **Example**
 *
 * ```ts
 * import { Loader, RequestRegistry } from "raf-effect-atom"
 *
 * const loader = Loader.make(RequestRegistry.make())
 * const comments = loader.prefetch(commentPage, 1, 0)
 * const issueHandle = await loader.ensure(issue, 1)
 * ```
 *
 * @stability unstable
 * @category constructors
 * @since 0.1.0
 */
export const make = (
	registry: AtomRegistry.AtomRegistry,
	options?: { readonly leaseTTL?: Duration.Input | undefined },
): Loader => {
	const leaseTTL =
		options?.leaseTTL === undefined
			? undefined
			: Duration.fromInputUnsafe(options.leaseTTL);
	const provide = <A>(
		effect: Effect.Effect<A, never, AtomRegistry.AtomRegistry>,
	): Effect.Effect<A> => {
		const provided = Effect.provideService(
			effect,
			AtomRegistry.AtomRegistry,
			registry,
		);
		return leaseTTL === undefined
			? provided
			: Effect.provideService(provided, LeaseTTL, leaseTTL);
	};
	return {
		ensure: (source, ...args) =>
			Effect.runPromise(provide(ensure(source, ...args))),
		fetch: (source, ...args) =>
			Effect.runPromise(provide(fetch(source, ...args))),
		prefetch: (source, ...args) =>
			Effect.runSync(provide(prefetch(source, ...args))),
	};
};
