import { createFileRoute } from "@tanstack/react-router";

import { webHandler } from "~/rpc.server.ts";

export const Route = createFileRoute("/rpc")({
	server: {
		handlers: { POST: ({ request }) => webHandler.handler(request) },
	},
});
