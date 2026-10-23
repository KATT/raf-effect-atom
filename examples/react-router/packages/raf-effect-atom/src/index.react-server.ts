/**
 * The main entry in server components, through the `react-server` export
 * condition: the same exports, with the server build of `HydrationBoundary`.
 *
 * @stability unstable
 * @since 0.3.0
 */

/**
 * @since 0.3.0
 */
export * from "./index.shared.ts";

/**
 * @since 0.3.0
 */
export { HydrationBoundary } from "./ReactHydration.react-server.tsx";
