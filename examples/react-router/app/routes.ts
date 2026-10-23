import {
	index,
	layout,
	route,
	type RouteConfig,
} from "@react-router/dev/routes";

export default [
	index("routes/home.tsx"),
	route("rpc", "routes/rpc.ts"),
	route("issues/*", "routes/issues.$.tsx"),
	layout("routes/pages.tsx", [
		route("prefetch/issues", "routes/prefetch/issues.tsx"),
		route("prefetch/issues/:issueId", "routes/prefetch/issue.tsx"),
		route("ensure/issues", "routes/ensure/issues.tsx"),
		route("ensure/issues/:issueId", "routes/ensure/issue.tsx"),
		route("fetch/issues", "routes/fetch/issues.tsx"),
		route("fetch/issues/:issueId", "routes/fetch/issue.tsx"),
		route("*", "routes/not-found.tsx"),
	]),
] satisfies RouteConfig;
