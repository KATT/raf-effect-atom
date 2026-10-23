import { createRouter } from "@tanstack/react-router";
import { Loader } from "raf-effect-atom";
import {
	makeRegistry,
	setupRouterAtoms,
} from "raf-effect-atom/tanstack-router";

import { requestCookie } from "./issues.ts";
import { routeTree } from "./routeTree.gen.ts";
import {
	readPrefetch,
	readRequestCookie,
	toDefaultPreload,
} from "./settings.ts";

export function getRouter() {
	// A request registry on the server, the browser's registry in the browser.
	const registry = makeRegistry();
	registry.set(requestCookie, readRequestCookie());
	const router = createRouter({
		context: { atoms: Loader.make(registry) },
		defaultPreload: toDefaultPreload(readPrefetch()),
		// The registry decides what it holds; loaders always run and start
		// their atoms there.
		defaultPreloadStaleTime: 0,
		// A revisit waits for its loader, as the URL's verb says. With the
		// default (`"background"`), the router renders the route's last loader
		// data and reruns the loader behind it, so `fetch` would never wait.
		defaultStaleReloadMode: "blocking",
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
