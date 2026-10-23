/**
 * TanStack Router loaders written as Effects.
 *
 * `run` runs a loader's (or a `beforeLoad`'s) Effect on the registry of the
 * router context's `atoms`, so the loader verbs need nothing provided, and
 * navigating away interrupts it. Its error channel holds only the router's
 * control flow: `notFound` and `redirect` fail with it, and the loader
 * throws the router's own value.
 *
 * The loader stays an arrow that takes TanStack's arguments, so the router
 * types them, and calls `run` with them.
 *
 * **Example**
 *
 * ```ts
 * import { createFileRoute } from "@tanstack/react-router"
 * import { Effect } from "effect"
 * import { Loader } from "raf-effect-atom"
 * import { RouteLoader } from "raf-effect-atom/tanstack-router"
 *
 * export const Route = createFileRoute("/issues/$id")({
 *   loader: (args) =>
 *     RouteLoader.run(
 *       args,
 *       Effect.gen(function* () {
 *         const comments = yield* Loader.prefetch(commentPage, args.params.id)
 *         const loaded = yield* Loader.ensure(issue, args.params.id).pipe(
 *           Loader.catchTags({ IssueNotFound: () => RouteLoader.notFound() }),
 *         )
 *         return { comments, issue: loaded }
 *       }),
 *     ),
 * })
 * ```
 *
 * @stability unstable
 * @since 0.1.0
 */
import {
	type AnyRedirect,
	type AnyRouter,
	type NotFoundError,
	notFound as routerNotFound,
	type RedirectOptions,
	type RegisteredRouter,
	redirect as routerRedirect,
} from "@tanstack/react-router";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Predicate from "effect/Predicate";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";

import type * as Loader from "./Loader.ts";

/**
 * A loader failed with the router's not-found: the loader throws
 * `notFound`, and the nearest `notFoundComponent` renders.
 *
 * @stability unstable
 * @category errors
 * @since 0.1.0
 */
export class NotFound extends Data.TaggedError("NotFound")<{
	readonly notFound: NotFoundError;
}> {}

/**
 * A loader failed with a redirect: the loader throws `redirect`, and the
 * router navigates there.
 *
 * @stability unstable
 * @category errors
 * @since 0.1.0
 */
export class Redirect extends Data.TaggedError("Redirect")<{
	readonly redirect: AnyRedirect;
}> {}

/**
 * What an Effect loader may fail with.
 *
 * @stability unstable
 * @category models
 * @since 0.1.0
 */
export type Signal = NotFound | Redirect;

/**
 * Fails with the router's not-found, which takes the options of
 * TanStack Router's `notFound`.
 *
 * @stability unstable
 * @category constructors
 * @since 0.1.0
 */
export const notFound = (
	options?: NotFoundError,
): Effect.Effect<never, NotFound> =>
	Effect.suspend(() =>
		Effect.fail(new NotFound({ notFound: routerNotFound(options) })),
	);

/**
 * Fails with a redirect, which takes the options of TanStack Router's
 * `redirect`, typed by the registered router.
 *
 * @stability unstable
 * @category constructors
 * @since 0.1.0
 */
export const redirect = <
	TRouter extends AnyRouter = RegisteredRouter,
	const TTo extends string | undefined = ".",
	const TFrom extends string = string,
	const TMaskFrom extends string = TFrom,
	const TMaskTo extends string = "",
>(
	options: RedirectOptions<TRouter, TFrom, TTo, TMaskFrom, TMaskTo>,
): Effect.Effect<never, Redirect> =>
	Effect.suspend(() => {
		const response: Response = routerRedirect(options);
		// SAFETY: `redirect` returns a `Redirect`, and `AnyRedirect` is any
		// router's `Redirect`, which `NavigateOptions`' conditional types keep
		// TypeScript from proving.
		const anyRedirect = response as AnyRedirect;
		return Effect.fail(new Redirect({ redirect: anyRedirect }));
	});

/**
 * What `run` needs from a loader's or a `beforeLoad`'s arguments: the
 * router context's `atoms`, and the abort controller.
 *
 * @stability unstable
 * @category models
 * @since 0.1.0
 */
export interface Args {
	readonly abortController: AbortController;
	readonly context: { readonly atoms: Loader.Loader };
}

const toThrown = (signal: Signal): unknown =>
	Predicate.isTagged(signal, "NotFound") ? signal.notFound : signal.redirect;

/**
 * Runs a loader's or a `beforeLoad`'s Effect, as the Promise the router
 * awaits.
 *
 * **Details**
 *
 * - The Effect runs on the registry of `context.atoms`, with its lease TTL.
 * - Aborting the navigation interrupts it. Atoms it started keep loading.
 * - A `NotFound` or a `Redirect` failure throws the router's own value. A
 *   defect throws its squashed cause.
 * - Other failures don't type-check: handle them with `Effect.catchTag`,
 *   or leave an atom's typed failure to a boundary.
 *
 * @stability unstable
 * @category running
 * @since 0.1.0
 */
export const run = <A>(
	args: Args,
	effect: Effect.Effect<A, Signal, AtomRegistry.AtomRegistry>,
): Promise<A> =>
	args.context.atoms.run(Effect.mapError(effect, toThrown), {
		signal: args.abortController.signal,
	});

/**
 * Runs a struct of Effects, usually loader verbs, concurrently, and returns
 * the struct of their results: for verbs, the handles the page reads.
 *
 * **Example**
 *
 * ```ts
 * loader: (args) =>
 *   RouteLoader.all(args, {
 *     comments: Loader.prefetch(commentPage, args.params.id),
 *     issue: Loader.ensure(issue, args.params.id),
 *   })
 * ```
 *
 * @stability unstable
 * @category running
 * @since 0.1.0
 */
export const all = <
	const Fields extends Record<
		string,
		Effect.Effect<unknown, Signal, AtomRegistry.AtomRegistry>
	>,
>(
	args: Args,
	fields: Fields,
): Promise<{ -readonly [K in keyof Fields]: Effect.Success<Fields[K]> }> =>
	run(
		args,
		// SAFETY: `Effect.all` over a struct succeeds with the struct of its
		// fields' successes, which its conditional return type hides from a
		// generic `Fields`.
		Effect.all(fields, { concurrency: "unbounded" }) as Effect.Effect<
			{ -readonly [K in keyof Fields]: Effect.Success<Fields[K]> },
			Signal,
			AtomRegistry.AtomRegistry
		>,
	);
