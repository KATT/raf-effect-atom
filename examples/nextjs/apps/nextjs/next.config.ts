import type { NextConfig } from "next";

export default {
	// Otherwise `next dev` writes `AGENTS.md` here whenever it detects a coding
	// agent. The repo's root `AGENTS.md` covers this app.
	agentRules: false,
	// CodeSandbox previews the dev server at `https://<id>-<port>.csb.app`;
	// Next.js blocks dev requests from other origins.
	allowedDevOrigins: ["*.csb.app"],
	// `bundle-check` reads which modules the browser gets from the client
	// build's source maps.
	productionBrowserSourceMaps: true,
	reactCompiler: true,
	// `/issues…` without a verb: the same page under `/prefetch`.
	redirects: () =>
		Promise.resolve([
			{
				destination: "/prefetch/issues",
				permanent: false,
				source: "/issues",
			},
			{
				destination: "/prefetch/issues/:path+",
				permanent: false,
				source: "/issues/:path+",
			},
		]),
} satisfies NextConfig;
