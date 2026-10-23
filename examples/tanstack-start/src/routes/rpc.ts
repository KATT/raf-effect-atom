import { createFileRoute } from "@tanstack/react-router";

import { handleRpc } from "~/rpc.server.ts";

export const Route = createFileRoute("/rpc")({
	server: {
		handlers: { POST: (context) => handleRpc(context.request) },
	},
});
