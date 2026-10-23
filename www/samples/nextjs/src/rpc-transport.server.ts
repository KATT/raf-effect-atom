import { RPC_PATH, webHandler } from "@examples/backend";
import { Layer } from "effect";
import { FetchHttpClient } from "effect/http";

/**
 * In server components, `IssuesClient` calls the RPC handler in this
 * process instead of making a request to its own origin. The host is a
 * placeholder; the handler routes by path.
 */
export const rpcUrl = `http://in-process${RPC_PATH}`;

export const RpcHttpClient = FetchHttpClient.layer.pipe(
	Layer.provide(
		Layer.succeed(FetchHttpClient.Fetch)((input, init) =>
			webHandler.handler(new Request(input, init)),
		),
	),
);
