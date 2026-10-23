import { RegistryProvider, WaterfallDetection } from "raf-effect-atom";
import {
	atomsMiddleware,
	clientAtomsMiddleware,
} from "raf-effect-atom/react-router";
import type { ReactNode } from "react";
import { Links, Meta, Outlet, Scripts } from "react-router";

import { atomsContext } from "~/atoms.ts";
import { AppBoundary, AuthBoundary } from "~/boundaries.tsx";

import type { Route } from "./+types/root";

// #region root
// Gives each server request its own registry, which every loader reads.
export const middleware: Array<Route.MiddlewareFunction> = [
	atomsMiddleware(atomsContext),
];
// Gives client loaders the browser's registry, under the same context.
export const clientMiddleware: Array<Route.ClientMiddlewareFunction> = [
	clientAtomsMiddleware(atomsContext),
];

export function Layout({ children }: { children: ReactNode }) {
	return (
		<html lang="en">
			<head>
				<Meta />
				<Links />
			</head>
			<body>
				{/* The browser's registry, which each route's HydrationBoundary fills. */}
				<RegistryProvider>
					{/* In development, a component that starts an atom no loader started throws. */}
					<WaterfallDetection mode="throw">{children}</WaterfallDetection>
				</RegistryProvider>
				<Scripts />
			</body>
		</html>
	);
}

export default function App() {
	return (
		<AppBoundary>
			<AuthBoundary>
				<Outlet />
			</AuthBoundary>
		</AppBoundary>
	);
}
// #endregion root
