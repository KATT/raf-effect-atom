import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import type { Loader } from "raf-effect-atom";

import { AuthBoundary } from "~/boundaries.tsx";

// #region root
export const Route = createRootRouteWithContext<{ atoms: Loader.Loader }>()({
	component: () => (
		<AuthBoundary>
			<Outlet />
		</AuthBoundary>
	),
});
// #endregion root
