import {
	deploymentHeaders,
	deploymentOf,
} from "@examples/kit/lib/skew-protection";

import type { RpcTransport } from "./issues.ts";

/**
 * `POST`s to the app's `/rpc` server route, on the page's origin, answered
 * by the deployment that served the page.
 */
export const rpcTransport: RpcTransport = {
	headers: deploymentHeaders(deploymentOf(import.meta.env)),
	url: "/rpc",
};
