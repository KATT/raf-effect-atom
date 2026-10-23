import { defineConfig } from "vite-plus";

export default defineConfig({
	pack: {
		entry: [
			"src/index.ts",
			"src/index-react-server.ts",
			"src/react-router.ts",
			"src/rsc.ts",
			"src/tanstack-router.tsx",
		],
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
		// Per package: `pnpm test` runs packages in parallel, and each Vitest
		// deletes a shared cache when the lockfile changes.
		fsModuleCachePath: "node_modules/.vitest-cache",
		projects: [
			{
				extends: true,
				test: {
					exclude: ["test/**/*.react-server.test.{ts,tsx}"],
					include: ["test/**/*.test.{ts,tsx}"],
					name: "dom",
				},
			},
			{
				extends: true,
				plugins: [
					{
						// What an RSC bundler does to a `"use client"` module: each
						// export becomes a client reference, and the module never runs.
						enforce: "pre",
						name: "client-references",
						transform: (code: string, id: string) => {
							if (!/^(?:\s|\/\*[\s\S]*?\*\/)*"use client"/.test(code)) {
								return undefined;
							}
							const names = [...code.matchAll(/^export const (\w+)/gm)].map(
								(match) => match[1],
							);
							return [
								'import { registerClientReference } from "react-server-dom-webpack/server";',
								...names.map(
									(name) =>
										`export const ${name} = registerClientReference(() => { throw new Error("${name} is a client component"); }, ${JSON.stringify(id)}, "${name}");`,
								),
							].join("\n");
						},
					},
				],
				ssr: {
					resolve: {
						conditions: ["react-server"],
						externalConditions: ["react-server"],
					},
				},
				test: {
					environment: "node",
					include: ["test/**/*.react-server.test.{ts,tsx}"],
					name: "react-server",
				},
			},
		],
		unstubGlobals: true,
	},
});
