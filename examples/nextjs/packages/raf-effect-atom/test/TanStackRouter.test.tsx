// @vitest-environment-options {"settings":{"enableJavaScriptEvaluation":true,"suppressInsecureJavaScriptEnvironmentWarning":true}}
import { assert, describe, it } from "@effect/vitest";
import {
	createMemoryHistory,
	createRootRoute,
	createRootRouteWithContext,
	createRoute,
	createRouter,
} from "@tanstack/react-router";
import { screen } from "@testing-library/react";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";

import { type LoadedHandle, Loader, RequestRegistry } from "../src/index.ts";
import { makeRegistry, setupRouterAtoms } from "../src/TanStackRouter.tsx";
import {
	counter,
	gated,
	later,
	requestName,
	serve,
	viewer,
} from "./fixtures/issues.ts";
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

	it("dehydrates an atom a loader started while the registry's async seed ran", async () => {
		const response = await renderOnServer("/greeting", {
			seed: async (registry) => {
				await later(10);
				registry.set(viewer, "ada");
			},
		});
		assert.include(response.html, "Hello, ada");
		using _app = await renderInBrowser("/greeting", response.html);
		assert.isDefined(screen.getByText("Hello, ada"));
	});

	it("renders and hydrates an atom that reads the request registry's initial value", async () => {
		const response = await renderOnServer("/welcome", {
			initialValues: [Atom.initialValue(requestName, "ada")],
		});
		assert.include(response.html, "Welcome, ada");
		using _app = await renderInBrowser("/welcome", response.html);
		assert.isDefined(screen.getByText("Welcome, ada"));
	});

	it("renders the page on the server and leaves a prefetchInBrowser read to the browser", async () => {
		using server = serve({});
		const response = await renderOnServer("/in-browser/5");
		assert.include(response.html, "Page");
		assert.include(response.html, "Opening");
		assert.strictEqual(server.requests(5), 0);
		using _app = await renderInBrowser("/in-browser/5", response.html);
		assert.isDefined(screen.getByText("Issue 5"));
		assert.strictEqual(server.requests(5), 1);
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

describe("a loader that runs its verbs with the navigation's signal", () => {
	it("stops waiting when another navigation supersedes it", async () => {
		using registry = disposable(AtomRegistry.make());
		const gate = gated("tanstack-router-signal");
		const waited = Promise.withResolvers<{
			readonly settled: PromiseSettledResult<LoadedHandle<typeof gate.atom>>;
			readonly signal: AbortSignal;
		}>();
		const rootRoute = createRootRouteWithContext<{
			readonly atoms: Loader.Loader;
		}>()();
		const gatedRoute = createRoute({
			getParentRoute: () => rootRoute,
			loader: async (match) => {
				const [settled] = await Promise.allSettled([
					match.context.atoms.run(Loader.ensure(gate.atom), {
						signal: match.abortController.signal,
					}),
				]);
				waited.resolve({ settled, signal: match.abortController.signal });
				return null;
			},
			path: "/gated",
		});
		const homeRoute = createRoute({
			getParentRoute: () => rootRoute,
			path: "/",
		});
		const router = createRouter({
			context: { atoms: Loader.make(registry.value) },
			history: createMemoryHistory({ initialEntries: ["/"] }),
			isServer: false,
			routeTree: rootRoute.addChildren([gatedRoute, homeRoute]),
		});
		await router.load();
		const leaving = router.navigate({ to: "/gated" });
		await later(5);
		await router.navigate({ to: "/" });
		const outcome = await waited.promise;
		assert.isTrue(outcome.signal.aborted);
		assert.strictEqual(outcome.settled.status, "rejected");
		assert.strictEqual(
			outcome.settled.status === "rejected"
				? outcome.settled.reason
				: undefined,
			outcome.signal.reason,
		);
		await leaving;
		assert.strictEqual(router.state.location.pathname, "/");
		gate.open("loaded");
		await later(5);
		const result = registry.value.get(gate.atom);
		assert.isTrue(AsyncResult.isSuccess(result) && result.value === "loaded");
	});
});

describe("makeRegistry", () => {
	it("makes a browser registry where there's a window", () => {
		using registry = disposable(makeRegistry());
		assert.isFalse(RequestRegistry.isRequestRegistry(registry.value));
	});

	it("starts the browser's registry with initialValues", () => {
		using registry = disposable(
			makeRegistry({ initialValues: [Atom.initialValue(requestName, "ada")] }),
		);
		assert.strictEqual(registry.value.get(requestName), "ada");
	});

	it("keeps an unread atom for defaultIdleTTL, 400 ms by default", async () => {
		using short = disposable(makeRegistry({ defaultIdleTTL: 50 }));
		using standard = disposable(makeRegistry());
		short.value.mount(counter)();
		standard.value.mount(counter)();
		await new Promise((resolve) => setTimeout(resolve, 200));
		assert.isFalse(short.value.getNodes().has(counter));
		assert.isTrue(standard.value.getNodes().has(counter));
	});
});

const disposable = (value: AtomRegistry.AtomRegistry) => ({
	[Symbol.dispose]: () => value.dispose(),
	value,
});
