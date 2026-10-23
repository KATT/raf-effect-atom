import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { type Loader, WaterfallDetection } from "raf-effect-atom";

import { AppBoundary, AuthBoundary } from "~/boundaries.tsx";

// #region root
export const Route = createRootRouteWithContext<{ atoms: Loader.Loader }>()({
	component: () => (
		// In development, a component that starts an atom no loader started throws.
		<WaterfallDetection mode="throw">
			<AppBoundary>
				<AuthBoundary>
					<Outlet />
				</AuthBoundary>
			</AppBoundary>
		</WaterfallDetection>
	),
});
// #endregion root
