import { type RouteConfig, route } from "@react-router/dev/routes";

export default [
	route("issues/:id", "routes/issues.$id.tsx"),
	route("rpc", "routes/rpc.ts"),
] satisfies RouteConfig;
