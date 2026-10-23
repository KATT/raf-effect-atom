// TanStack Start's Vite plugin writes this into `routeTree.gen.ts`. The
// reference loads Start's types, which add `server` handlers to file routes.
/// <reference types="@tanstack/react-start" />

import type { getRouter } from "./router.tsx";

declare module "@tanstack/react-start" {
	interface Register {
		router: ReturnType<typeof getRouter>;
		ssr: true;
	}
}
