import { IssueRpcs } from "@examples/contract";
import { Issues } from "@examples/db";
import { Layer } from "effect";
import { RpcSerialization, RpcServer } from "effect/rpc";

import { AuthorizationLayer } from "./authorization.ts";
import { IssueHandlersNoDeps } from "./issue-handlers.ts";
import { LatencyLayer } from "./latency.ts";

/** Where the apps and the standalone server serve the procedures. */
export const RPC_PATH = "/rpc";

/** `POST /rpc`, with `Issues` still to provide. */
export const RpcRoutesNoDeps = RpcServer.layerHttp({
	group: IssueRpcs,
	path: RPC_PATH,
	protocol: "http",
}).pipe(
	Layer.provide([
		IssueHandlersNoDeps,
		AuthorizationLayer,
		LatencyLayer,
		RpcSerialization.layerJson,
	]),
);

/** `POST /rpc` over the process-wide issue tables. */
export const RpcRoutes = RpcRoutesNoDeps.pipe(Layer.provide(Issues.layer));
