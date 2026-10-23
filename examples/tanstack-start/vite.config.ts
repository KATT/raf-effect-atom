import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite-plus";

export default defineConfig((env) => ({
	// Tests import the app's modules directly, without the Start build.
	plugins:
		env.mode === "test"
			? []
			: [
					tailwindcss(),
					tanstackStart(),
					nitro(),
					react(),
					babel({
						// The libraries resolve to their source here but are published
						// uncompiled, and React Compiler hoists closures out of their
						// factories (`createErrorBoundary`'s handlers), so compile only what
						// an app would: its own code, not what it installs.
						exclude: [
							/[/\\]node_modules[/\\]/,
							/[/\\]packages[/\\][^/\\]+[/\\]src[/\\]/,
							/^\0rolldown\/runtime\.js$/,
						],
						presets: [reactCompilerPreset()],
					}),
				],
	resolve: {
		tsconfigPaths: true,
	},
	// Bundle every dependency into the server build. Vite keeps the ones it
	// can resolve from here (`react`) external and inlines the ones it can't
	// (Base UI's CommonJS `use-sync-external-store`), leaving a
	// `require("react")` that Nitro's bundle can't follow: on Vercel, with no
	// `node_modules`, every request fails.
	ssr: env.command === "build" ? { noExternal: true } : {},
	test: {
		include: ["src/**/*.test.ts"],
	},
}));
