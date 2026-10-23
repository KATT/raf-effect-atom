import { webHandler } from "~/rpc.server.ts";

import type { Route } from "./+types/rpc";

export function action({ request }: Route.ActionArgs) {
	return webHandler.handler(request);
}
