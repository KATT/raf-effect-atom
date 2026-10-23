import { HttpRouter } from "effect/http";

import { RpcRoutes } from "./RpcRoutes.ts";

/**
 * `POST /rpc` as a fetch handler (`webHandler.handler`), for each app's one
 * server-only RPC route and for server rendering, which calls it in-process.
 */
export const webHandler = HttpRouter.toWebHandler(RpcRoutes, {
	disableLogger: true,
});
