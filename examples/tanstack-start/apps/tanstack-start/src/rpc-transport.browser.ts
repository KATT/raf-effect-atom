import type { RpcTransport } from "./issues.ts";

/** `POST`s to the app's `/rpc` server route, on the page's origin. */
export const rpcTransport: RpcTransport = { url: "/rpc" };
