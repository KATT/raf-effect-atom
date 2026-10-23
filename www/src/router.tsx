import { createRouter } from "@tanstack/react-router";
import { Loader } from "raf-effect-atom";
import {
	makeRegistry,
	setupRouterAtoms,
} from "raf-effect-atom/tanstack-router";

import { NotFound } from "./components/not-found.tsx";
import { reloadForStaleChunk, RouteError } from "./components/route-error.tsx";
import { routeTree } from "./routeTree.gen.ts";

export function getRouter() {
	const registry = makeRegistry();
	const router = createRouter({
		context: { atoms: Loader.make(registry) },
		defaultErrorComponent: RouteError,
		defaultNotFoundComponent: NotFound,
		defaultOnCatch: reloadForStaleChunk,
		defaultPreload: "intent",
		// The registry decides what's fresh; loaders always run and reuse it.
		defaultPreloadStaleTime: 0,
		routeTree,
		scrollRestoration: true,
	});
	setupRouterAtoms({ registry, router });
	return router;
}

declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof getRouter>;
	}
}
