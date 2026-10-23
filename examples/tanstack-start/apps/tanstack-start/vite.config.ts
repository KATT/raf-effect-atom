import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { envPrefix } from "@examples/kit/lib/skew-protection";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite-plus";

export default defineConfig((env) => ({
	environments: {
		client: {
			build: {
				// `bundle-check` reads which modules the browser gets from the
				// client build's source maps. Hidden: the chunks don't point to
				// them. Without the sources: route modules' maps would carry
				// the server code the client build strips.
				rolldownOptions: { output: { sourcemapExcludeSources: true } },
				sourcemap: "hidden",
			},
		},
	},
	envPrefix,
	// Tests import the app's modules directly, without the Start build.
	plugins:
		env.mode === "test"
			? []
			: [
					tailwindcss(),
					tanstackStart(),
					// Nitro's Skew Protection sets `__vdpl` on `/`, which also pins
					// documents to the deployment that set it: a reload never gets
					// the latest one. `pinAssets` and the RPC transport pin the
					// page's own requests instead.
					nitro({ vercel: { skewProtection: false } }),
					react(),
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
	// Bundle every dependency into the server build. Vite keeps the ones it
	// can resolve from here (`react`) external and inlines the ones it can't
	// (Base UI's CommonJS `use-sync-external-store`), leaving a
	// `require("react")` that Nitro's bundle can't follow: on Vercel, with no
	// `node_modules`, every request fails.
	ssr: env.command === "build" ? { noExternal: true } : {},
	test: {
		// Per package: `pnpm test` runs packages in parallel, and each Vitest
		// deletes a shared cache when the lockfile changes.
		fsModuleCachePath: "node_modules/.vitest-cache",
		include: ["src/**/*.test.ts"],
	},
}));
