import { defineConfig } from "vite-plus";

export default defineConfig({
	pack: {
		entry: ["src/index.ts", "src/next.ts", "src/tanstack-router.tsx"],
		unbundle: true,
	},
	test: {
		clearMocks: true,
		coverage: {
			include: ["src"],
			reporter: ["html", "lcov"],
		},
		environment: "happy-dom",
		exclude: ["dist", "node_modules"],
		projects: [
			{
				extends: true,
				test: {
					exclude: ["test/**/*.rsc.test.{ts,tsx}"],
					include: ["test/**/*.test.{ts,tsx}"],
					name: "dom",
				},
			},
			{
				extends: true,
				ssr: {
					resolve: {
						conditions: ["react-server"],
						externalConditions: ["react-server"],
					},
				},
				test: {
					environment: "node",
					include: ["test/**/*.rsc.test.{ts,tsx}"],
					name: "react-server",
				},
			},
		],
		unstubGlobals: true,
	},
});
