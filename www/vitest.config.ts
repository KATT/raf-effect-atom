import { defineConfig } from "vite-plus";

// Separate from `vite.config.ts`, whose Start and markdown plugins compile the
// whole site.
export default defineConfig({
	resolve: {
		tsconfigPaths: true,
	},
	test: {
		// Per package: `pnpm test` runs packages in parallel, and each Vitest
		// deletes a shared cache when the lockfile changes.
		fsModuleCachePath: "node_modules/.vitest-cache",
		include: ["build/**/*.test.ts", "src/**/*.test.ts"],
		unstubGlobals: true,
	},
});
