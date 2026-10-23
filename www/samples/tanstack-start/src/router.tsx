import { createRouter } from "@tanstack/react-router";
import { Loader } from "raf-effect-atom";
import {
	makeRegistry,
	setupRouterAtoms,
} from "raf-effect-atom/tanstack-router";

import { routeTree } from "./routeTree.gen.ts";

// #region router
export function getRouter() {
	// A request registry on the server, the browser's registry in the browser.
	const registry = makeRegistry();
	const router = createRouter({
		routeTree,
		context: { atoms: Loader.make(registry) },
		defaultPreload: "intent",
	});
	setupRouterAtoms({ router, registry });
	return router;
}
// #endregion router
