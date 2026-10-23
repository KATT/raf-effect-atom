import { BrowserRuntime, BrowserWorkerRunner } from "@effect/platform-browser";
import { Layer } from "effect";
import { RpcServer } from "effect/rpc";

import { DemoRpcs } from "../rpcs.ts";
import { ServerLayer } from "./server.ts";

/**
 * A demo's server, in its own Web Worker. A defect fails only its own
 * request, as it does over HTTP, instead of every request the client has in
 * flight.
 */
const Main = RpcServer.layer(DemoRpcs, { disableFatalDefects: true }).pipe(
	Layer.provide(ServerLayer),
	Layer.provide(RpcServer.layerProtocolWorkerRunner),
	Layer.provide(BrowserWorkerRunner.layer),
);

BrowserRuntime.runMain(Layer.launch(Main));
