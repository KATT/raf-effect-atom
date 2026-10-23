/**
 * Starts atoms from route loaders, before anything renders, so nothing
 * waterfalls.
 *
 * Each verb starts an `AsyncResult` atom in the registry and takes a lease
 * on it, so the registry's idle TTL can't evict it before the route renders
 * and `useAtomResult` takes it over:
 *
 * | Verb       | Starts the atom                 | Waits                         | Has a value already   |
 * | ---------- | ------------------------------- | ----------------------------- | --------------------- |
 * | `prefetch` | if it isn't in the registry     | never                         | leaves it alone       |
 * | `ensure`   | if it isn't in the registry     | only while it's `Initial`     | returns it at once    |
 * | `fetch`    | if it isn't, or refreshes it    | until the new result settles  | refreshes, then waits |
 *
 * Typed failures don't reject: `ensure` and `fetch` return the settled
 * `AsyncResult`, so a loader can redirect on a tag and otherwise let a
 * boundary render the failure. Only defects and interruptions reject.
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

import { hydrated } from "./Hydration.ts";
import { isDevelopment } from "./internal/development.ts";
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
 * Starts an atom without waiting for it.
 *
 * **When to use**
 *
 * Use for data the route needs but its loader doesn't: it streams in while
 * the route renders.
 *
 * **Details**
 *
 * Starts the atom if it isn't in the registry, and leaves it alone if it is.
 * Takes a lease either way.
 *
 * **Example**
 *
 * ```ts
 * import { Effect } from "effect"
 * import { Loader } from "raf-effect-atom"
 *
 * const program = Loader.prefetch(comments(1))
 * ```
 *
 * @stability unstable
 * @category verbs
 * @since 0.1.0
 */
export const prefetch: <A, E>(
	atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
) => Effect.Effect<void, never, AtomRegistry.AtomRegistry> = Effect.fnUntraced(
	function* <A, E>(atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>) {
		yield* start(atom);
	},
);

/**
 * Starts an atom and returns its settled result, waiting only while it has
 * none.
 *
 * **When to use**
 *
 * Use when the loader needs the result, such as to redirect on a tag, or
 * when the route shouldn't render without it.
 *
 * **Details**
 *
 * An atom with a result returns it at once, without refetching. On a request
 * registry, it also waits out a refresh in flight, so the server never
 * renders a result that's about to change. A typed failure is returned as
 * the result; a defect or an interruption fails the Effect.
 *
 * **Example**
 *
 * ```ts
 * import { Effect } from "effect"
 * import { AsyncResult } from "effect/reactivity"
 * import { Loader } from "raf-effect-atom"
 *
 * const program = Effect.gen(function* () {
 *   const result = yield* Loader.ensure(issue(1))
 *   return AsyncResult.isSuccess(result) ? result.value.title : "missing"
 * })
 * ```
 *
 * @stability unstable
 * @category verbs
 * @since 0.1.0
 */
export const ensure: <A, E>(
	atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
) => Effect.Effect<SettledResult<A, E>, never, AtomRegistry.AtomRegistry> =
	Effect.fnUntraced(function* <A, E>(
		atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
	) {
		const started = yield* start(atom);
		return yield* settled(
			started.registry,
			started.target,
			started.request ? isSettled : AsyncResult.isNotInitial,
		);
	});

/**
 * Starts an atom, or refreshes it if it has a result, and returns the new
 * settled result.
 *
 * **When to use**
 *
 * Use when the loader must not see a result from before it ran, such as
 * after a mutation.
 *
 * **Details**
 *
 * Waits until the result settles and isn't refreshing. A typed failure is
 * returned as the result; a defect or an interruption fails the Effect.
 *
 * @stability unstable
 * @category verbs
 * @since 0.1.0
 */
export const fetch: <A, E>(
	atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
) => Effect.Effect<SettledResult<A, E>, never, AtomRegistry.AtomRegistry> =
	Effect.fnUntraced(function* <A, E>(
		atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
	) {
		const started = yield* start(atom);
		const { registry, target } = started;
		if (started.existed && isSettled(registry.get(target))) {
			// An `Atom.family` makes a member again once the garbage collector
			// takes it, such as an AtomRpc query: its refresh reaches inner atoms
			// the registry doesn't run, so refresh the atom its node runs.
			const node = registry.getNodes().get(Leases.keyOf(target));
			registry.refresh(node?.atom ?? target);
		}
		return yield* settled(registry, target, isSettled);
	});

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
	readonly ensure: <A, E>(
		atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
	) => Promise<SettledResult<A, E>>;
	/** {@link fetch}, as a Promise that rejects only on a defect. */
	readonly fetch: <A, E>(
		atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
	) => Promise<SettledResult<A, E>>;
	/** {@link prefetch}, run at once. */
	readonly prefetch: <A, E>(
		atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
	) => void;
}

/**
 * Creates the Promise verbs over one registry.
 *
 * **When to use**
 *
 * Use in a framework integration, in loaders that are async functions, or
 * in an event handler that starts an atom before the state change that
 * renders its reader, such as the next page of a list. In Effect code, use
 * the verbs directly with the `AtomRegistry` provided.
 *
 * **Example**
 *
 * ```ts
 * import { Loader, RequestRegistry } from "raf-effect-atom"
 *
 * const loader = Loader.make(RequestRegistry.make())
 * loader.prefetch(comments(1))
 * const result = await loader.ensure(issue(1))
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
		ensure: (atom) => Effect.runPromise(provide(ensure(atom))),
		fetch: (atom) => Effect.runPromise(provide(fetch(atom))),
		prefetch: (atom) => {
			Effect.runSync(provide(prefetch(atom)));
		},
	};
};
