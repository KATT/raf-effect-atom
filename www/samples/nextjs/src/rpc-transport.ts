import { FetchHttpClient } from "effect/http";

/** In client components, `IssuesClient` posts to the app's RPC route. */
export const rpcUrl = "/rpc";

export const RpcHttpClient = FetchHttpClient.layer;
