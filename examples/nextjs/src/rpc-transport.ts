import type { RpcTransport } from "./issues.ts";

/**
 * `POST`s to the app's `/rpc` route handler, on the page's origin. Client
 * components' server render starts no request: every atom they read there is
 * hydrated from a server component's `HydrateAtoms`.
 */
export const rpcTransport: RpcTransport = { url: "/rpc" };
