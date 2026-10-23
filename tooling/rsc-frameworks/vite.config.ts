import { defineConfig } from "vite-plus";

export default defineConfig({
	test: {
		environment: "node",
		// Per package: `pnpm test` runs packages in parallel, and each Vitest
		// deletes a shared cache when the lockfile changes.
		fsModuleCachePath: "node_modules/.vitest-cache",
		include: ["src/**/*.test.ts"],
		unstubEnvs: true,
	},
});
