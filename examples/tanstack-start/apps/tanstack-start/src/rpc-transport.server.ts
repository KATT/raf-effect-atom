import { RPC_PATH, webHandler } from "@examples/backend";

import type { RpcTransport } from "./issues.ts";

/**
 * Calls the RPC handler in this process, without a network round trip.
 * Server rendering uses it: a request to the server's own origin would need
 * to know the origin, and would hold a second connection while the page
 * renders. The host is a placeholder; the handler routes by path.
 */
export const rpcTransport: RpcTransport = {
	fetch: (input, init) => webHandler.handler(new Request(input, init)),
	url: `http://in-process${RPC_PATH}`,
};
