import { RegistryContext } from "@effect/atom-react";
import { cn } from "@examples/ui/lib/utils";
import {
	type AnyRoute,
	type AnyRouter,
	createMemoryHistory,
	createRouter,
	RouterProvider,
	useRouterState,
} from "@tanstack/react-router";
import { Atom, type AtomRegistry } from "effect/reactivity";
import { Lock } from "lucide-react";
import { Loader } from "raf-effect-atom";
import { setupRouterAtoms } from "raf-effect-atom/tanstack-router";
import { type ReactNode, use, useState } from "react";

import { stateFill } from "./state.tsx";

/** What a demo's loaders get on their router context, as in an app. */
export interface DemoRouterContext {
	readonly atoms: Loader.Loader;
}

/** One navigation, from the router's `onBeforeNavigate` to `onResolved`. */
export interface Navigation {
	readonly href: string;
	/** `undefined` until the new page renders. */
	readonly resolvedAt: number | undefined;
	readonly startedAt: number;
}

const maxNavigations = 8;

function makeNavigations(name: string) {
	return Atom.make<ReadonlyArray<Navigation>>([]).pipe(
		Atom.keepAlive,
		Atom.withLabel(`demo-kit:navigations:${name}`),
	);
}

/** A demo router's navigations, oldest first, by the router's name. */
export const navigationsAtom = Atom.family(makeNavigations);

/** Records a router's navigations in {@link navigationsAtom}. */
function recordNavigations(
	router: AnyRouter,
	name: string,
	registry: AtomRegistry.AtomRegistry,
) {
	const navigations = navigationsAtom(name);
	const update = (
		f: (all: ReadonlyArray<Navigation>) => ReadonlyArray<Navigation>,
	) => {
		registry.set(navigations, f(registry.get(navigations)));
	};
	router.subscribe("onBeforeNavigate", (event) => {
		const startedAt = Date.now();
		update((all) => [
			// A navigation another one replaced before it resolved never will.
			...all
				.filter((each) => each.resolvedAt !== undefined)
				.slice(1 - maxNavigations),
			{ href: event.toLocation.href, resolvedAt: undefined, startedAt },
		]);
	});
	router.subscribe("onResolved", (event) => {
		const resolvedAt = Date.now();
		update((all) =>
			all.map((each) =>
				each.resolvedAt === undefined && each.href === event.toLocation.href
					? { ...each, resolvedAt }
					: each,
			),
		);
	});
}

/**
 * A TanStack router over a memory history, wired to the demo's registry the
 * way an app's `getRouter` is: `Loader.make(registry)` on its context, and
 * `setupRouterAtoms`.
 */
function makeDemoRouter(
	name: string,
	routeTree: AnyRoute,
	registry: AtomRegistry.AtomRegistry,
) {
	const router = createRouter({
		context: { atoms: Loader.make(registry) } satisfies DemoRouterContext,
		// A stale loader reruns before the page renders, instead of the router
		// showing its last loader data meanwhile, so what a verb waits for is
		// what the navigation waits for.
		defaultStaleReloadMode: "blocking",
		history: createMemoryHistory({ initialEntries: ["/"] }),
		routeTree,
		// The router scrolls the window to the top after each navigation unless
		// this returns false. The window is the docs page, not the demo.
		scrollRestoration: () => false,
	});
	setupRouterAtoms({ registry, router });
	// The listeners live as long as the router, which lives as long as the
	// registry's session.
	recordNavigations(router, name, registry);
	return router;
}

/**
 * Makes a demo router once per registry, recording its navigations in
 * {@link navigationsAtom} under `name`.
 */
export function useDemoRouter(name: string, routeTree: AnyRoute) {
	const registry = use(RegistryContext);
	const [router] = useState(() => makeDemoRouter(name, routeTree, registry));
	return router;
}

/**
 * A demo router's app in a small browser window. While a navigation waits
 * for its loaders, the address bar shows the new URL over a striped bar and
 * the old page stays, dimmed: the router has no pending component.
 */
export function BrowserWindow(props: {
	readonly className?: string;
	/** Above the address bar, such as the loader's code. */
	readonly header?: ReactNode;
	readonly router: AnyRouter;
}) {
	const router = props.router;
	const href = useRouterState({
		router,
		select: (state) => state.location.href,
	});
	const isNavigating = useRouterState({
		router,
		select: (state) => state.status === "pending",
	});
	return (
		<div
			className={cn(
				"flex min-w-0 flex-col overflow-hidden rounded-lg border bg-background shadow-xs",
				props.className,
			)}
		>
			{props.header}
			<div className="relative flex items-center gap-1.5 border-b bg-muted/40 px-2 py-1.5">
				<Lock aria-hidden className="size-3 shrink-0 text-muted-foreground" />
				<span className="truncate font-mono text-[11px] text-muted-foreground">
					demo.local{href}
				</span>
				{isNavigating ? (
					<>
						<span className="sr-only">Loading</span>
						<span
							aria-hidden
							className={cn(
								"absolute inset-x-0 bottom-0 h-1",
								stateFill.waiting,
							)}
						/>
					</>
				) : null}
			</div>
			<div
				aria-busy={isNavigating}
				className={cn(
					"min-h-24 p-3 transition-opacity motion-reduce:transition-none",
					isNavigating && "opacity-50",
				)}
			>
				<RouterProvider router={router} />
			</div>
		</div>
	);
}
