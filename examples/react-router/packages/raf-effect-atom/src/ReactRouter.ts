/**
 * Connects the loader verbs to React Router's Framework Mode.
 *
 * A root `middleware` gives each server request its own registry, under a
 * router context the app creates. Loaders start atoms with its verbs and
 * return its `dehydrate()` with their data; the route component hydrates it
 * with `HydrationBoundary`, inside the root's `RegistryProvider`, both from
 * `raf-effect-atom`. A root `clientMiddleware` puts the browser's registry
 * under the same context, so one function can be both the route's `loader`
 * and its `clientLoader`: after the first page, loaders run in the browser,
 * where `ensure` finds what the registry already holds. Nothing is imported
 * from `react-router`.
 *
 * **Example**
 *
 * ```tsx
 * // app/atoms.ts
 * import { createContext } from "react-router"
 * import type { RequestAtoms } from "raf-effect-atom/react-router"
 *
 * export const atomsContext = createContext<RequestAtoms>()
 *
 * // app/root.tsx
 * import { atomsMiddleware } from "raf-effect-atom/react-router"
 *
 * export const middleware = [atomsMiddleware(atomsContext)]
 * export const clientMiddleware = [clientAtomsMiddleware(atomsContext)]
 *
 * // app/routes/issue.tsx
 * async function load(args: Route.LoaderArgs) {
 *   const atoms = args.context.get(atomsContext)
 *   const handle = await atoms.ensure(issue, Number(args.params.id))
 *   return { atoms: atoms.dehydrate(), issue: handle }
 * }
 *
 * export const loader = load
 * export const clientLoader = load
 *
 * export default function IssueRoute(props: Route.ComponentProps) {
 *   return (
 *     <HydrationBoundary state={props.loaderData.atoms}>
 *       <Issue issue={props.loaderData.issue} />
 *     </HydrationBoundary>
 *   )
 * }
 * ```
 *
 * @stability unstable
 * @since 0.1.0
 */
import * as Predicate from "effect/Predicate";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type * as EffectHydration from "effect/reactivity/Hydration";

import * as Hydration from "./Hydration.ts";
import * as Registry from "./internal/registry.ts";
import * as Loader from "./Loader.ts";
import * as RequestRegistry from "./RequestRegistry.ts";

/**
 * One request's registry, with the loader verbs over it. In a client loader,
 * the browser's registry, whose `dehydrate` returns nothing: its atoms are
 * already where the components read them.
 *
 * @stability unstable
 * @category models
 * @since 0.1.0
 */
export interface RequestAtoms extends Loader.Loader {
	/** `Hydration.dehydrate` on the request's registry, for loader data. */
	readonly dehydrate: () => Array<EffectHydration.DehydratedAtom>;
	readonly registry: AtomRegistry.AtomRegistry;
}

/**
 * The router context `atomsMiddleware` sets: what `react-router`'s
 * `createContext<RequestAtoms>()` returns.
 *
 * @stability unstable
 * @category models
 * @since 0.1.0
 */
export interface AtomsContext {
	readonly defaultValue?: RequestAtoms | undefined;
}

/**
 * The parts of React Router's middleware arguments `atomsMiddleware` uses.
 *
 * @stability unstable
 * @category models
 * @since 0.1.0
 */
export interface MiddlewareArgs {
	readonly context: {
		readonly set: (context: AtomsContext, value: RequestAtoms) => void;
	};
	readonly request: Request;
}

/**
 * Options for `atomsMiddleware`.
 *
 * @stability unstable
 * @category models
 * @since 0.2.0
 */
export interface AtomsMiddlewareOptions {
	/**
	 * Runs on each request's registry before the loaders, with the request,
	 * to set what its atoms need, such as its cookie. The middleware waits
	 * for one that returns a promise.
	 */
	readonly seed?:
		| ((
				registry: AtomRegistry.AtomRegistry,
				request: Request,
		  ) => void | Promise<void>)
		| undefined;
}

/**
 * Creates a root middleware that gives each server request its own
 * registry, under the given router context.
 *
 * **Details**
 *
 * The registry is disposed once the response's body has been sent, or the
 * client has gone: loader data streams its pending promises after the
 * middleware returns, so the atoms behind them must keep running until
 * then. When `next` doesn't return a `Response`, as Data Mode's
 * `query` can, the registry is left to be collected with the request.
 *
 * `seed` runs on the new registry before `next`, so every loader's atoms
 * start with what it sets.
 *
 * The verbs take the request's `signal`: when the client goes before the
 * response, such as a navigation that leaves while its loaders wait, the
 * `ensure` and `fetch` calls still waiting reject with its reason.
 *
 * **Gotchas**
 *
 * It's server middleware: export it as the root route's `middleware`, not
 * `clientMiddleware`, which takes `clientAtomsMiddleware`.
 *
 * **Example**
 *
 * ```ts
 * export const middleware = [
 *   atomsMiddleware(atomsContext, {
 *     // In-process RPC calls send the page request's cookie.
 *     seed: (registry, request) =>
 *       registry.set(requestCookie, request.headers.get("cookie") ?? undefined)
 *   })
 * ]
 * ```
 *
 * @stability unstable
 * @category integrations
 * @since 0.1.0
 */
export const atomsMiddleware =
	(context: AtomsContext, options?: AtomsMiddlewareOptions) =>
	async <Result>(
		args: MiddlewareArgs,
		next: () => Promise<Result>,
	): Promise<Result> => {
		const seed = options?.seed;
		const registry = RequestRegistry.make({
			seed:
				seed === undefined
					? undefined
					: (created) => seed(created, args.request),
		});
		try {
			await RequestRegistry.settled(registry);
		} catch (error) {
			registry.dispose();
			throw error;
		}
		const loader = Loader.make(registry, { signal: args.request.signal });
		args.context.set(context, {
			...loader,
			dehydrate: () => Hydration.dehydrate(registry),
			registry,
		});
		let result: Result;
		try {
			result = await next();
		} catch (error) {
			registry.dispose();
			throw error;
		}
		if (!isResponse(result)) {
			return result;
		}
		const body = result.body;
		if (body === null) {
			registry.dispose();
			return result;
		}
		// SAFETY: `result` is a Response, so a Response is a `Result`.
		const response = new Response(
			disposeAfter(body, registry),
			result,
		) as Result;
		return response;
	};

const isResponse = (value: unknown): value is Response =>
	Predicate.hasProperty(value, "body") &&
	Predicate.hasProperty(value, "headers") &&
	Predicate.hasProperty(value, "status");

const disposeAfter = (
	body: ReadableStream<Uint8Array>,
	registry: AtomRegistry.AtomRegistry,
): ReadableStream<Uint8Array> => {
	const reader = body.getReader();
	return new ReadableStream<Uint8Array>({
		cancel: async (reason) => {
			registry.dispose();
			await reader.cancel(reason);
		},
		pull: async (controller) => {
			try {
				const chunk = await reader.read();
				if (chunk.done) {
					registry.dispose();
					controller.close();
				} else {
					controller.enqueue(chunk.value);
				}
			} catch (error) {
				registry.dispose();
				controller.error(error);
			}
		},
	});
};

/**
 * Creates a root client middleware that gives client loaders the browser's
 * registry, under the context `atomsMiddleware` uses on the server.
 *
 * **When to use**
 *
 * Export it as the root route's `clientMiddleware`, and each route's loader
 * function as both its `loader` and its `clientLoader`. The first page's loaders run on
 * the server and stream their atoms in; after that, navigations run the
 * loaders in the browser. `ensure` then renders what the browser's registry
 * holds without a request, and a link's prefetch doesn't fetch a route's
 * `.data` that the click would fetch again.
 *
 * **Details**
 *
 * The registry is the one the mounted `RegistryProvider` provides. Its
 * `dehydrate` returns nothing, so a loader's data has the same shape in
 * the browser and on the server, and `HydrationBoundary` has nothing to do.
 * The verbs take the navigation's `signal`: when another navigation
 * interrupts it, the `ensure` and `fetch` calls still waiting reject with
 * its reason, and the atoms keep loading.
 *
 * **Gotchas**
 *
 * The atoms run in the browser, so their RPC protocol must reach the server
 * from there, as it does for anything a component starts.
 *
 * **Example**
 *
 * ```ts
 * // app/root.tsx
 * export const middleware = [atomsMiddleware(atomsContext)]
 * export const clientMiddleware = [clientAtomsMiddleware(atomsContext)]
 *
 * // app/routes/issue.tsx: one function for both, since React Router
 * // removes `loader` from the browser's bundle.
 * export const loader = load
 * export const clientLoader = load
 * ```
 *
 * @stability unstable
 * @category integrations
 * @since 0.2.1
 */
export const clientAtomsMiddleware =
	(context: AtomsContext) =>
	<Result>(
		args: MiddlewareArgs,
		next: () => Promise<Result>,
	): Promise<Result> => {
		const registry = Registry.current();
		if (registry === undefined) {
			throw new Error(
				"clientAtomsMiddleware found no mounted RegistryProvider: render raf-effect-atom's RegistryProvider around the app in the root layout.",
			);
		}
		args.context.set(context, {
			...Loader.make(registry, { signal: args.request.signal }),
			dehydrate: () => [],
			registry,
		});
		return next();
	};
