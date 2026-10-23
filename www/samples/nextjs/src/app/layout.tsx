import { RegistryProvider, WaterfallDetection } from "raf-effect-atom";
import type { ReactNode } from "react";

import { AppBoundary, AuthBoundary } from "~/boundaries.tsx";

// #region layout
// The verbs make each request's registry, so the server needs no setup.
export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html lang="en">
			<body>
				{/* The browser's registry, which each page's HydrationBoundary fills. */}
				<RegistryProvider>
					{/* In development, a component that starts an atom no server component started throws. */}
					<WaterfallDetection mode="throw">
						<AppBoundary>
							<AuthBoundary>{children}</AuthBoundary>
						</AppBoundary>
					</WaterfallDetection>
				</RegistryProvider>
			</body>
		</html>
	);
}
// #endregion layout
