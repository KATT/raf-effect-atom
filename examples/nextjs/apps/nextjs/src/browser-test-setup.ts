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

/** The pages the tests open. */
const testedPaths = [
	"/prefetch/issues/999",
	"/ensure/issues/999",
	"/fetch/issues/999",
	"/prefetch/issues/3",
];

/**
 * Renders each tested page once, so no test pays for `next start` loading
 * a route's server code on its first request.
 */
const warmUpApp = async (origin: string) => {
	for (const path of testedPaths) {
		await (await fetch(`${origin}${path}`)).text();
	}
};

/**
 * Opens a page in Chrome once, so the first test doesn't pay for Chrome
 * starting its first renderer. Playwright takes a stack trace on every
 * call, and Vitest's module runner throws formatting any stack trace taken
 * in a global setup, so its formatting is off meanwhile.
 */
const warmUpChrome = async (endpoint: string, url: string) => {
	await using stack = new AsyncDisposableStack();
	const prepareStackTrace = Error.prepareStackTrace;
	Reflect.deleteProperty(Error, "prepareStackTrace");
	stack.defer(() => {
		Error.prepareStackTrace = prepareStackTrace;
	});
	const browser = await chromium.connect(endpoint);
	stack.defer(() => browser.close());
	const page = await browser.newPage();
	await page.goto(url, { waitUntil: "networkidle" });
};

/**
 * Starts the app's server and a Chrome once for the run, and warms both,
 * outside every test's time: on a fresh CI runner, Chrome's first start
 * takes seconds, and the first page each needed took the first test past
 * Vitest's timeout.
 */
export default async function setup(project: TestProject) {
	await using stack = new AsyncDisposableStack();
	const app = stack.use(await startApp());
	await warmUpApp(app.origin);
	const chrome = await chromium.launchServer({ channel: "chrome" });
	stack.defer(() => chrome.close());
	await warmUpChrome(chrome.wsEndpoint(), `${app.origin}${testedPaths[0]}`);
	project.provide("appOrigin", app.origin);
	project.provide("chromeEndpoint", chrome.wsEndpoint());
	const owned = stack.move();
	return () => owned.disposeAsync();
}
