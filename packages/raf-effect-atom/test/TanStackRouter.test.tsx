// @vitest-environment-options {"settings":{"enableJavaScriptEvaluation":true,"suppressInsecureJavaScriptEnvironmentWarning":true}}
import { assert, describe, it } from "@effect/vitest";
import { createRootRoute, createRouter } from "@tanstack/react-router";
import { screen } from "@testing-library/react";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";

import { RequestRegistry } from "../src/index.ts";
import { makeRegistry, setupRouterAtoms } from "../src/TanStackRouter.tsx";
import { counter, serve } from "./fixtures/Issues.ts";
import { renderInBrowser, renderOnServer } from "./fixtures/router.tsx";

describe("setupRouterAtoms", () => {
	it("renders a server-side IssueNotFound as an IssueNotFound after hydration", async () => {
		using server = serve({ 1: ["missing"] });
		const response = await renderOnServer("/issues/1");
		assert.include(response.html, "IssueNotFound 1");
		using _app = await renderInBrowser("/issues/1", response.html);
		assert.isDefined(screen.getByText("IssueNotFound 1"));
		assert.strictEqual(server.requests(1), 1);
	});

	it("hydrates a result the loader waited for without requesting it again", async () => {
		using server = serve({});
		const response = await renderOnServer("/issues/1");
		assert.include(response.html, "Issue 1");
		using _app = await renderInBrowser("/issues/1", response.html);
		assert.isDefined(screen.getByText("Issue 1"));
		assert.strictEqual(server.requests(1), 1);
	});

	it("streams a result the loader started without requesting it again", async () => {
		using server = serve({});
		const response = await renderOnServer("/streamed/2");
		assert.match(response.html, /_tag:"Initial".+resultPromise:\$R\[\d+\]=/);
		using _app = await renderInBrowser("/streamed/2", response.html);
		assert.isDefined(screen.getByText("Issue 2"));
		assert.strictEqual(server.requests(2), 1);
	});

	it("streams a typed failure as its own error", async () => {
		using server = serve({ 3: ["missing"] });
		const response = await renderOnServer("/streamed/3");
		using _app = await renderInBrowser("/streamed/3", response.html);
		assert.isDefined(screen.getByText("IssueNotFound 3"));
		assert.strictEqual(server.requests(3), 1);
	});

	it("keeps the router's own Wrap, dehydrate and hydrate", async () => {
		using _server = serve({});
		const response = await renderOnServer("/issues/1");
		assert.include(response.html, `<main>`);
		assert.include(response.html, `app:"state"`);
		using app = await renderInBrowser("/issues/1", response.html);
		assert.isDefined(document.querySelector("main"));
		assert.deepStrictEqual(app.hydrated, ["state"]);
	});

	it("disposes the request registry when the response finishes", async () => {
		using _server = serve({});
		const response = await renderOnServer("/issues/1");
		assert.throws(() => response.registry.get(counter), /disposed/);
	});

	it("refuses a server router without a request registry", () => {
		using registry = disposable(AtomRegistry.make());
		const router = createRouter({
			isServer: true,
			routeTree: createRootRoute(),
		});
		assert.throws(
			() => setupRouterAtoms({ registry: registry.value, router }),
			/without a request registry/,
		);
	});

	it("refuses a browser router with a request registry", () => {
		using registry = disposable(RequestRegistry.make());
		const router = createRouter({
			isServer: false,
			routeTree: createRootRoute(),
		});
		assert.throws(
			() => setupRouterAtoms({ registry: registry.value, router }),
			/with a request registry/,
		);
	});
});

describe("makeRegistry", () => {
	it("makes a browser registry where there's a window", () => {
		using registry = disposable(makeRegistry());
		assert.isFalse(RequestRegistry.isRequestRegistry(registry.value));
	});
});

const disposable = (value: AtomRegistry.AtomRegistry) => ({
	[Symbol.dispose]: () => value.dispose(),
	value,
});
