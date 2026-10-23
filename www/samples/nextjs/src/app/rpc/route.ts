import { webHandler } from "~/rpc.server.ts";

export const POST = (request: Request) => webHandler.handler(request);
