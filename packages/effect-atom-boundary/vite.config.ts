import babel from "@rolldown/plugin-babel";
import { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";

export default defineConfig({
	pack: {
		entry: ["src/index.ts"],
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
		include: ["test/**/*.test.{ts,tsx}"],
		projects: [
			{ extends: true, test: { name: "dom" } },
			{
				extends: true,
				// Apps that compile their workspace packages with React Compiler
				// (Next.js does by default) compile `src` too.
				plugins: [
					babel({
						include: [/[/\\]effect-atom-boundary[/\\]src[/\\]/],
						presets: [reactCompilerPreset()],
					}),
				],
				test: { name: "react-compiler" },
			},
		],
		unstubGlobals: true,
	},
});
