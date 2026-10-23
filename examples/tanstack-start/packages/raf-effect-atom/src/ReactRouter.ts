/**
 * Connects the loader verbs to React Router's Framework Mode.
 *
 * A root `middleware` gives each server request its own registry, under a
 * router context the app creates. Loaders start atoms with its verbs and
 * return its `dehydrate()` with their data; the route component hydrates it
 * with `HydrationBoundary`, inside the root's `RegistryProvider`. Nothing is
 * imported from `react-router`.
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
 *
 * // app/routes/issue.tsx
 * export async function loader(args: Route.LoaderArgs) {
 *   const atoms = args.context.get(atomsContext)
 *   const handle = await atoms.ensure(issue, Number(args.params.id))
 *   return { atoms: atoms.dehydrate(), issue: handle }
 * }
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
import * as Loader from "./Loader.ts";
import * as RequestRegistry from "./RequestRegistry.ts";

export {
	/**
	 * @since 0.1.0
	 */
	RegistryProvider,
} from "./RegistryProvider.tsx";

/**
 * One request's registry, with the loader verbs over it.
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
 * **Gotchas**
 *
 * It's server middleware: export it as the root route's `middleware`, not
 * `clientMiddleware`. In the browser, the root's `RegistryProvider` holds
 * the registry.
 *
 * @stability unstable
 * @category integrations
 * @since 0.1.0
 */
export const atomsMiddleware =
	(context: AtomsContext) =>
	async <Result>(
		args: MiddlewareArgs,
		next: () => Promise<Result>,
	): Promise<Result> => {
		const registry = RequestRegistry.make();
		const loader = Loader.make(registry);
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
