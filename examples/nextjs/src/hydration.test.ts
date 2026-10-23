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

/**
 * Opens a page of the app in Chrome, recording the browser's `/rpc` requests
 * and uncaught errors (a hydration mismatch is one). The server's default
 * latency stays on, so `prefetch` streams its results after the shell.
 */
const visit = async (path: string) => {
	await using stack = new AsyncDisposableStack();
	const app = stack.use(await startApp());
	const browser = stack.use(await chromium.launch({ channel: "chrome" }));
	const page = await browser.newPage();
	const rpcRequests: Array<string> = [];
	const pageErrors: Array<string> = [];
	page.on("request", (request) => {
		if (new URL(request.url()).pathname.startsWith("/rpc")) {
			rpcRequests.push(request.postData() ?? "");
		}
	});
	page.on("pageerror", (error) => pageErrors.push(error.message));
	await page.goto(`${app.origin}${path}`, { waitUntil: "networkidle" });
	const owned = stack.move();
	return {
		page,
		pageErrors,
		rpcRequests,
		[Symbol.asyncDispose]: () => owned.disposeAsync(),
	};
};

describe("the server's results in the browser", () => {
	// `prefetch` streams each result; `ensure` and `fetch` send it settled.
	for (const verb of ["prefetch", "ensure", "fetch"] as const) {
		it(`renders IssueBoundary's IssueNotFound on /${verb}/issues/999`, async () => {
			await using visited = await visit(`/${verb}/issues/999`);
			const caught = visited.page.locator(
				'[role="alert"][data-boundary="IssueBoundary"][data-tag="IssueNotFound"]',
			);
			await caught.waitFor();

			assert.include(await caught.textContent(), "Issue #999 doesn't exist.");
			assert.deepStrictEqual(visited.rpcRequests, []);
			assert.deepStrictEqual(visited.pageErrors, []);
		});
	}

	it("hydrates /prefetch/issues/3 from the stream without requesting it again", async () => {
		await using visited = await visit("/prefetch/issues/3");
		await visited.page.getByText("2 comments").waitFor();

		assert.deepStrictEqual(visited.rpcRequests, []);
		assert.deepStrictEqual(visited.pageErrors, []);
	});
});
