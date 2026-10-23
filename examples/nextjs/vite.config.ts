import { defineConfig } from "vite-plus";

export default defineConfig({
	test: {
		globalSetup: ["./src/browser-test-setup.ts"],
	},
});
