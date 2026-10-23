import { envPrefix } from "@examples/kit/lib/skew-protection";
import { reactRouter } from "@react-router/dev/vite";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";

export default defineConfig((env) => ({
	environments: {
		client: {
			build: {
				// `bundle-check` reads which modules the browser gets from the
				// client build's source maps. Hidden: the chunks don't point to
				// them. Without the sources: route modules' maps would carry
				// the loaders' source text, which the client build strips.
				rolldownOptions: { output: { sourcemapExcludeSources: true } },
				sourcemap: "hidden",
			},
		},
	},
	envPrefix,
	// Tests import the app's modules directly, without the React Router build.
	plugins:
		env.mode === "test"
			? []
			: [
					tailwindcss(),
					reactRouter(),
					babel({
						exclude: [/[/\\]node_modules[/\\]/, /^\0rolldown\/runtime\.js$/],
						presets: [reactCompilerPreset()],
					}),
				],
	resolve: {
		tsconfigPaths: true,
	},
	// CodeSandbox previews the dev server at `https://<id>-<port>.csb.app`.
	server: { allowedHosts: [".csb.app"] },
	test: {
		// Per package: `pnpm test` runs packages in parallel, and each Vitest
		// deletes a shared cache when the lockfile changes.
		fsModuleCachePath: "node_modules/.vitest-cache",
		include: ["app/**/*.test.ts"],
	},
}));
