import { assert, describe, it } from "@effect/vitest";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

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

describe("a missing issue in the browser", () => {
	// `prefetch` streams the failure; `ensure` and `fetch` send it settled.
	for (const verb of ["prefetch", "ensure", "fetch"] as const) {
		it(`renders IssueBoundary's IssueNotFound on /${verb}/issues/999 from the server's result`, async () => {
			await using app = await startApp();
			await using browser = await chromium.launch({ channel: "chrome" });
			await using context = await browser.newContext();
			await context.addCookies([
				{ name: "db-latency", url: app.origin, value: "0" },
			]);
			const page = await context.newPage();
			const rpcRequests: Array<string> = [];
			const pageErrors: Array<string> = [];
			page.on("request", (request) => {
				if (new URL(request.url()).pathname.startsWith("/rpc")) {
					rpcRequests.push(request.postData() ?? "");
				}
			});
			page.on("pageerror", (error) => pageErrors.push(error.message));

			await page.goto(`${app.origin}/${verb}/issues/999`, {
				waitUntil: "networkidle",
			});
			const caught = page.locator(
				'[role="alert"][data-boundary="IssueBoundary"][data-tag="IssueNotFound"]',
			);
			await caught.waitFor();

			assert.include(await caught.textContent(), "Issue #999 doesn't exist.");
			assert.deepStrictEqual(rpcRequests, []);
			assert.deepStrictEqual(pageErrors, []);
		});
	}
});
