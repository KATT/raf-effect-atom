import { LATENCY_COOKIE } from "@examples/contract";
import { assert, describe, layer } from "@effect/vitest";
import { Context, Effect, Layer } from "effect";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { type Browser, chromium } from "playwright-core";

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

const acquireDisposable = <A extends AsyncDisposable>(
	acquire: () => Promise<A>,
) =>
	Effect.acquireRelease(Effect.promise(acquire), (resource) =>
		Effect.promise(() => resource[Symbol.asyncDispose]()),
	);

/**
 * The app's production server and a Chrome, started once for the file: a
 * cold Chrome start alone can take most of a test's time on CI.
 */
class App extends Context.Service<
	App,
	{ readonly browser: Browser; readonly origin: string }
>()("App") {
	static readonly layer = Layer.effect(
		App,
		Effect.gen(function* () {
			const server = yield* acquireDisposable(startApp);
			const browser = yield* acquireDisposable(() =>
				chromium.launch({ channel: "chrome" }),
			);
			return { browser, origin: server.origin };
		}),
	);
}

/**
 * Opens a page of the app in a fresh browser context, recording the
 * browser's `/rpc` requests and uncaught errors (a hydration mismatch is
 * one). Each procedure takes 100 ms, so `prefetch` streams its results after
 * the shell.
 */
const visit = Effect.fn("visit")(function* (path: string) {
	const app = yield* App;
	const context = yield* acquireDisposable(() => app.browser.newContext());
	yield* Effect.promise(() =>
		context.addCookies([
			{ name: LATENCY_COOKIE, url: app.origin, value: "100" },
		]),
	);
	const page = yield* Effect.promise(() => context.newPage());
	const rpcRequests: Array<string> = [];
	const pageErrors: Array<string> = [];
	page.on("request", (request) => {
		if (new URL(request.url()).pathname.startsWith("/rpc")) {
			rpcRequests.push(request.postData() ?? "");
		}
	});
	page.on("pageerror", (error) => pageErrors.push(error.message));
	yield* Effect.promise(() =>
		page.goto(`${app.origin}${path}`, { waitUntil: "networkidle" }),
	);
	return { page, pageErrors, rpcRequests };
});

describe("the server's results in the browser", () => {
	layer(App.layer)((it) => {
		// `prefetch` streams each result; `ensure` and `fetch` send it settled.
		for (const verb of ["prefetch", "ensure", "fetch"] as const) {
			it.effect(
				`renders IssueBoundary's IssueNotFound on /${verb}/issues/999`,
				() =>
					Effect.gen(function* () {
						const visited = yield* visit(`/${verb}/issues/999`);
						const caught = visited.page.locator(
							'[role="alert"][data-boundary="IssueBoundary"][data-tag="IssueNotFound"]',
						);
						yield* Effect.promise(() => caught.waitFor());

						assert.include(
							yield* Effect.promise(() => caught.textContent()),
							"Issue #999 doesn't exist.",
						);
						assert.deepStrictEqual(visited.rpcRequests, []);
						assert.deepStrictEqual(visited.pageErrors, []);
					}),
			);
		}

		it.effect(
			"hydrates /prefetch/issues/3 from the stream without requesting it again",
			() =>
				Effect.gen(function* () {
					const visited = yield* visit("/prefetch/issues/3");
					yield* Effect.promise(() =>
						visited.page.getByText("2 comments").waitFor(),
					);

					assert.deepStrictEqual(visited.rpcRequests, []);
					assert.deepStrictEqual(visited.pageErrors, []);
				}),
		);
	});
});
