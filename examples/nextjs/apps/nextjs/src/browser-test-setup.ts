import { spawn } from "node:child_process";
import { once } from "node:events";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import type { TestProject } from "vite-plus/test/node";

declare module "vite-plus/test" {
	export interface ProvidedContext {
		/** The origin `next start` serves the production build on. */
		readonly appOrigin: string;
		/** Where tests connect to the Chrome this setup launched. */
		readonly chromeEndpoint: string;
	}
}

const appDir = fileURLToPath(new URL("..", import.meta.url));
const nextBin = createRequire(import.meta.url).resolve("next/dist/bin/next");

/**
 * `next start` serving the production build, which `pnpm build` makes, on a
 * port the system picks. Next prints the origin it listens on.
 */
const startApp = async (): Promise<
	AsyncDisposable & { readonly origin: string }
> => {
	const child = spawn(process.execPath, [nextBin, "start", "--port", "0"], {
		cwd: appDir,
		stdio: ["ignore", "pipe", "pipe"],
	});
	const stop = async () => {
		if (child.exitCode === null) {
			child.kill();
			await once(child, "exit");
		}
	};
	let output = "";
	const origin = new Promise<string>((resolve, reject) => {
		const onData = (chunk: Buffer) => {
			output += chunk.toString();
			const local = /Local:\s+(\S+)/.exec(output)?.[1];
			if (local !== undefined && output.includes("Ready in")) {
				resolve(local);
			}
		};
		child.stdout.on("data", onData);
		child.stderr.on("data", onData);
		child.once("exit", () => {
			reject(new Error(`next start exited before it was ready:\n${output}`));
		});
	});
	try {
		return { origin: await origin, [Symbol.asyncDispose]: stop };
	} catch (error) {
		await stop();
		throw error;
	}
};

/**
 * Starts the app's server and a Chrome once for the run, outside every
 * test's time: Chrome's first start on a fresh CI runner takes seconds.
 */
export default async function setup(project: TestProject) {
	await using stack = new AsyncDisposableStack();
	const app = stack.use(await startApp());
	const chrome = await chromium.launchServer({ channel: "chrome" });
	stack.defer(() => chrome.close());
	project.provide("appOrigin", app.origin);
	project.provide("chromeEndpoint", chrome.wsEndpoint());
	const owned = stack.move();
	return () => owned.disposeAsync();
}
