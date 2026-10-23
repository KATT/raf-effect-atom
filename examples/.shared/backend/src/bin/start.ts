#!/usr/bin/env node
/** Serves the backend on its own: `PORT` (3001) at `/rpc`. */
import { NodeHttpServer, NodeRuntime } from "@effect/platform-node";
import { Config, Effect, Layer } from "effect";
import { HttpRouter } from "effect/http";
import { createServer } from "node:http";

import { RpcRoutes } from "../rpc-routes.ts";

const HttpServerLayer = Layer.unwrap(
	Effect.gen(function* () {
		const port = yield* Config.Port("PORT").pipe(Config.withDefault(3001));
		return HttpRouter.serve(RpcRoutes).pipe(
			Layer.provide(NodeHttpServer.layer(createServer, { port })),
		);
	}),
);

Layer.launch(HttpServerLayer).pipe(NodeRuntime.runMain);
