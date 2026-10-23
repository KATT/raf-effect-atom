import { webHandler } from "@examples/backend";

/** `POST /rpc` from the browser, answered by the backend in this process. */
export const handleRpc = (request: Request) => webHandler.handler(request);
