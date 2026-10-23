import { defineConfig } from "vite-plus";

export default defineConfig({
	pack: {
		entry: [
			"workspace.ts",
			"anti-slop/index.ts",
			"anti-slop/effect/index.ts",
			"nkzw/index.ts",
		],
		format: "esm",
		outExtensions: () => ({ js: ".js" }),
	},
	test: {
		// Per package: `pnpm test` runs packages in parallel, and each Vitest
		// deletes a shared cache when the lockfile changes.
		fsModuleCachePath: "node_modules/.vitest-cache",
		include: ["**/*.test.ts"],
		exclude: ["dist", "node_modules"],
	},
});
