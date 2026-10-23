import { LATENCY_COOKIE } from "@examples/contract";
import { assert, describe, it } from "@effect/vitest";
import { chromium } from "playwright-core";
import { inject } from "vite-plus/test";

/**
 * Opens a page of the app in the run's Chrome (`browser-test-setup.ts`),
 * recording the browser's `/rpc` requests and uncaught errors (a hydration
 * mismatch is one). Each procedure takes 100 ms, so `prefetch` streams its
 * results after the shell.
 */
const visit = async (path: string) => {
	const origin = inject("appOrigin");
	await using stack = new AsyncDisposableStack();
	const browser = stack.use(await chromium.connect(inject("chromeEndpoint")));
	const context = await browser.newContext();
	await context.addCookies([
		{ name: LATENCY_COOKIE, url: origin, value: "100" },
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
	await page.goto(`${origin}${path}`, { waitUntil: "networkidle" });
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
