import { deploymentHeaders } from "@examples/kit/lib/skew-protection";

import type { RpcTransport } from "./issues.ts";

/**
 * `POST`s to the app's `/rpc` route handler, on the page's origin, answered
 * by the deployment that served the page: Next.js pins its own requests to
 * it, not this `fetch`. Client components' server render starts no request:
 * every atom they read there is hydrated from a server component's
 * `HydrateAtoms`.
 */
export const rpcTransport: RpcTransport = {
	headers: deploymentHeaders(process.env.NEXT_DEPLOYMENT_ID || undefined),
	url: "/rpc",
};
