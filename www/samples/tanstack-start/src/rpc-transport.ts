import { FetchHttpClient } from "effect/http";

/** In the browser, `IssuesClient` posts to the app's RPC route. */
export const rpcUrl = "/rpc";

export const RpcHttpClient = FetchHttpClient.layer;
