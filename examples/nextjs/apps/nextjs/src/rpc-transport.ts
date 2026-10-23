import type { RpcTransport } from "./issues.ts";

const deploymentId = process.env.NEXT_DEPLOYMENT_ID;

/**
 * `POST`s to the app's `/rpc` route handler, on the page's origin, answered
 * by the deployment that served the page: Next.js pins its own requests to
 * it, not this `fetch`. Client components' server render starts no request:
 * every atom they read there is hydrated from a server component's
 * `HydrationBoundary`.
 */
export const rpcTransport: RpcTransport = {
	headers: deploymentId ? { "x-deployment-id": deploymentId } : {},
	url: "/rpc",
};
