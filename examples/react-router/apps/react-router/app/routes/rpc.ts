import { handleRpc } from "~/rpc.server.ts";

import type { Route } from "./+types/rpc";

export function action(args: Route.ActionArgs) {
	return handleRpc(args.request);
}
