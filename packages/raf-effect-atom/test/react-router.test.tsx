import { RegistryContext } from "@effect/atom-react";
import { assert, describe, it } from "@effect/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import * as Option from "effect/Option";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type * as EffectHydration from "effect/reactivity/Hydration";
import * as Schema from "effect/Schema";
import * as React from "react";
import {
	createContext,
	createMemoryRouter,
	createStaticHandler,
	RouterContextProvider,
	RouterProvider,
	useLoaderData,
} from "react-router";

import {
	type Handle,
	HydrationBoundary,
	type LoadedHandle,
	Loader,
	RegistryProvider,
	RequestRegistry,
	useAtomResult,
} from "../src/index.ts";
import {
	atomsMiddleware,
	clientAtomsMiddleware,
	type RequestAtoms,
} from "../src/react-router.ts";
import { settle } from "./fixtures/browser.tsx";
import {
	counter,
	gated,
	greeting,
	issue,
	IssueNotFound,
	later,
	serve,
	viewer,
} from "./fixtures/issues.ts";
import { wire } from "./fixtures/wire.ts";

const atomsContext = createContext<RequestAtoms>();

interface IssueData {
	readonly atoms: Array<EffectHydration.DehydratedAtom>;
	readonly issue: Handle<typeof issue>;
	readonly registry: AtomRegistry.AtomRegistry;
}

const handler = createStaticHandler([
	{
		children: [
			{
				loader: async (args): Promise<IssueData> => {
					const atoms = args.context.get(atomsContext);
					const handle = await atoms.ensure(issue, Number(args.params.id));
					return {
						atoms: atoms.dehydrate(),
						issue: handle,
						registry: atoms.registry,
					};
				},
				path: "issues/:id",
			},
			{
				loader: (args): IssueData => {
					const atoms = args.context.get(atomsContext);
					const handle = atoms.prefetch(issue, Number(args.params.id));
					return {
						atoms: atoms.dehydrate(),
						issue: handle,
						registry: atoms.registry,
					};
				},
				path: "streamed/:id",
			},
			{
				loader: (args): IssueData => {
					const atoms = args.context.get(atomsContext);
					const handle = atoms.prefetchInBrowser(issue, Number(args.params.id));
					return {
						atoms: atoms.dehydrate(),
						issue: handle,
						registry: atoms.registry,
					};
				},
				path: "in-browser/:id",
			},
		],
		id: "root",
		middleware: [atomsMiddleware(atomsContext)],
		path: "/",
	},
]);

const streamOf = (entry: EffectHydration.DehydratedAtom) =>
	"resultPromise" in entry ? entry.resultPromise : undefined;

/**
 * Handles a request as React Router's server does: the middleware runs
 * around the loaders, and the response streams the loader data's pending
 * promises after it returns, as Single Fetch does.
 */
const handle = async (path: string) => {
	const request = new Request(`http://localhost${path}`);
	let data: IssueData | undefined;
	const response = await handler.query(request, {
		generateMiddlewareResponse: async (query) => {
			const context = await query(request);
			if ("loaderData" in context) {
				data = Object.values(context.loaderData).find(
					(value): value is IssueData => value !== undefined,
				);
			}
			const streams = data?.atoms.map(streamOf) ?? [];
			const body = new ReadableStream<Uint8Array>({
				start: async (controller) => {
					controller.enqueue(new TextEncoder().encode("head"));
					await Promise.all(streams);
					controller.enqueue(new TextEncoder().encode("tail"));
					controller.close();
				},
			});
			return new Response(body);
		},
		requestContext: new RouterContextProvider(),
	});
	if (data === undefined || !("body" in response)) {
		throw new Error("the request didn't run a loader to a response");
	}
	return { data, response };
};

const isIssueNotFound = Schema.is(IssueNotFound);

function Title(props: { readonly issue: Handle<typeof issue> }) {
	const result = useAtomResult(issue, props.issue);
	if (AsyncResult.isSuccess(result)) {
		return <p>{result.value.title}</p>;
	}
	const error = AsyncResult.error(result);
	return (
		<p>
			{Option.isSome(error) && isIssueNotFound(error.value)
				? `IssueNotFound ${error.value.id}`
				: "Other failure"}
		</p>
	);
}

/** Renders the route in the browser from its loader data. */
const renderRoute = async (data: IssueData) => {
	await act(async () => {
		render(
			<RegistryProvider>
				<HydrationBoundary state={wire(data.atoms)}>
					<React.Suspense fallback={<p>Loading</p>}>
						<Title issue={structuredClone(data.issue)} />
					</React.Suspense>
				</HydrationBoundary>
			</RegistryProvider>,
		);
	});
	await settle();
	return { [Symbol.dispose]: cleanup };
};

describe("atomsMiddleware", () => {
	it("sends a loader's IssueNotFound that hydrates as an IssueNotFound", async () => {
		using server = serve({ 1: ["missing"] });
		const handled = await handle("/issues/1");
		await handled.response.text();
		using _route = await renderRoute(handled.data);
		assert.isDefined(screen.getByText("IssueNotFound 1"));
		assert.strictEqual(server.requests(1), 1);
	});

	it("streams a prefetched result without requesting it again", async () => {
		using server = serve({});
		const handled = await handle("/streamed/2");
		using _route = await renderRoute(handled.data);
		await handled.response.text();
		await settle();
		assert.isDefined(screen.getByText("Issue 2"));
		assert.strictEqual(server.requests(2), 1);
	});

	it("leaves a prefetchInBrowser read to the browser", async () => {
		using server = serve({});
		const handled = await handle("/in-browser/3");
		await handled.response.text();
		assert.deepStrictEqual(handled.data.atoms, []);
		assert.strictEqual(server.requests(3), 0);
		using _route = await renderRoute(handled.data);
		assert.isDefined(screen.getByText("Issue 3"));
		assert.strictEqual(server.requests(3), 1);
	});

	it("disposes the request's registry once the response body has been sent", async () => {
		using _server = serve({});
		const handled = await handle("/streamed/3");
		const registry = handled.data.registry;
		assert.doesNotThrow(() => registry.get(counter));
		assert.strictEqual(await handled.response.text(), "headtail");
		assert.throws(() => registry.get(counter), /disposed/);
	});

	it("disposes the registry when the client cancels the response", async () => {
		using _server = serve({});
		const handled = await handle("/streamed/4");
		await handled.response.body?.cancel();
		assert.throws(() => handled.data.registry.get(counter), /disposed/);
	});

	it("stops a loader's wait when the client leaves, with the request's abort reason", async () => {
		const gate = gated("react-router-signal");
		const waited =
			Promise.withResolvers<
				PromiseSettledResult<LoadedHandle<typeof gate.atom>>
			>();
		const leaving = createStaticHandler([
			{
				id: "root",
				loader: async (args) => {
					const atoms = args.context.get(atomsContext);
					const [settled] = await Promise.allSettled([atoms.ensure(gate.atom)]);
					waited.resolve(settled);
					return null;
				},
				middleware: [atomsMiddleware(atomsContext)],
				path: "/",
			},
		]);
		const controller = new AbortController();
		const request = new Request("http://localhost/", {
			signal: controller.signal,
		});
		const querying = leaving
			.query(request, {
				generateMiddlewareResponse: async (query) => {
					await query(request);
					return new Response("done");
				},
				requestContext: new RouterContextProvider(),
			})
			.catch(() => undefined);
		await later(5);
		const reason = new Error("the client left");
		controller.abort(reason);
		const settled = await waited.promise;
		assert.strictEqual(settled.status, "rejected");
		assert.strictEqual(
			settled.status === "rejected" ? settled.reason : undefined,
			reason,
		);
		await querying;
	});

	it("gives each request its own registry", async () => {
		using _server = serve({});
		const first = await handle("/issues/5");
		const second = await handle("/issues/5");
		assert.notStrictEqual(first.data.registry, second.data.registry);
		await Promise.all([first.response.text(), second.response.text()]);
	});
});

describe("atomsMiddleware's seed", () => {
	const seeded = createStaticHandler([
		{
			id: "root",
			loader: async (args) => {
				const atoms = args.context.get(atomsContext);
				return Loader.result(await atoms.ensure(greeting));
			},
			middleware: [
				atomsMiddleware(atomsContext, {
					seed: async (registry, request) => {
						await later(5);
						registry.set(viewer, request.headers.get("x-viewer") ?? undefined);
					},
				}),
			],
			path: "/",
		},
	]);

	it("runs on the request's registry before the loaders", async () => {
		const request = new Request("http://localhost/", {
			headers: { "x-viewer": "ada" },
		});
		let greeted: unknown;
		await seeded.query(request, {
			generateMiddlewareResponse: async (query) => {
				const context = await query(request);
				if ("loaderData" in context) {
					greeted = context.loaderData.root;
				}
				return new Response("done");
			},
			requestContext: new RouterContextProvider(),
		});
		assert.isTrue(
			AsyncResult.isAsyncResult(greeted) &&
				AsyncResult.isSuccess(greeted) &&
				greeted.value === "Hello, ada",
		);
	});
});

describe("clientAtomsMiddleware", () => {
	/** A Data Mode router whose loaders run in the browser, as client loaders do. */
	const browserRouter = () =>
		createMemoryRouter([
			{
				children: [
					{ element: <p>Home</p>, path: "/" },
					{
						Component: function IssueRoute() {
							const data = useLoaderData<IssueData>();
							return (
								<HydrationBoundary state={data.atoms}>
									<Title issue={data.issue} />
								</HydrationBoundary>
							);
						},
						loader: async (args): Promise<IssueData> => {
							const atoms = args.context.get(atomsContext);
							const loaded = await atoms.ensure(issue, Number(args.params.id));
							return {
								atoms: atoms.dehydrate(),
								issue: loaded,
								registry: atoms.registry,
							};
						},
						path: "issues/:id",
					},
				],
				middleware: [clientAtomsMiddleware(atomsContext)],
			},
		]);

	it("runs loaders over the browser's registry, so ensure doesn't ask twice", async () => {
		using server = serve({});
		const router = browserRouter();
		await act(async () => {
			render(
				<RegistryProvider>
					<RouterProvider router={router} />
				</RegistryProvider>,
			);
		});
		using _rendered = { [Symbol.dispose]: cleanup };
		await act(() => router.navigate("/issues/1"));
		await settle();
		assert.isDefined(screen.getByText("Issue 1"));
		await act(() => router.navigate("/"));
		await act(() => router.navigate("/issues/1"));
		assert.isDefined(screen.getByText("Issue 1"));
		assert.strictEqual(server.requests(1), 1);
		const data = Object.values(router.state.loaderData).find(
			(value): value is IssueData => value !== undefined,
		);
		assert.deepStrictEqual(data?.atoms, []);
		assert.isFalse(
			data === undefined || RequestRegistry.isRequestRegistry(data.registry),
		);
	});

	it("stops a loader's wait when another navigation interrupts it", async () => {
		const gate = gated("react-router-client-signal");
		const waited = Promise.withResolvers<{
			readonly settled: PromiseSettledResult<LoadedHandle<typeof gate.atom>>;
			readonly signal: AbortSignal;
		}>();
		let registry: AtomRegistry.AtomRegistry | undefined;
		const router = createMemoryRouter([
			{
				children: [
					{ element: <p>Home</p>, path: "/" },
					{
						loader: async (args) => {
							const atoms = args.context.get(atomsContext);
							registry = atoms.registry;
							const [settled] = await Promise.allSettled([
								atoms.ensure(gate.atom),
							]);
							waited.resolve({ settled, signal: args.request.signal });
							return null;
						},
						path: "gated",
					},
				],
				middleware: [clientAtomsMiddleware(atomsContext)],
			},
		]);
		await act(async () => {
			render(
				<RegistryProvider>
					<RouterProvider router={router} />
				</RegistryProvider>,
			);
		});
		using _rendered = { [Symbol.dispose]: cleanup };
		const leaving = router.navigate("/gated");
		await later(5);
		await act(() => router.navigate("/"));
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
		assert.isDefined(screen.getByText("Home"));
		// The atom keeps loading in the browser's registry.
		gate.open("loaded");
		await settle();
		const result = registry?.get(gate.atom);
		assert.isTrue(
			result !== undefined &&
				AsyncResult.isSuccess(result) &&
				result.value === "loaded",
		);
	});

	it("fails the navigation without a mounted RegistryProvider", async () => {
		using _server = serve({});
		const router = browserRouter();
		await act(() => router.navigate("/issues/1"));
		assert.match(
			String(Object.values(router.state.errors ?? {})[0]),
			/no mounted RegistryProvider/,
		);
		router.dispose();
	});
});

describe("RegistryProvider", () => {
	it("keeps an unread atom for defaultIdleTTL in the browser", async () => {
		const registries: Array<AtomRegistry.AtomRegistry> = [];
		function Capture() {
			registries.push(React.useContext(RegistryContext));
			return null;
		}
		render(
			<>
				<RegistryProvider defaultIdleTTL={50}>
					<Capture />
				</RegistryProvider>
				<RegistryProvider>
					<Capture />
				</RegistryProvider>
			</>,
		);
		using _rendered = { [Symbol.dispose]: cleanup };
		const [short, standard] = registries;
		assert.isDefined(short);
		assert.isDefined(standard);
		short.mount(counter)();
		standard.mount(counter)();
		await settle(200);
		assert.isFalse(short.getNodes().has(counter));
		assert.isTrue(standard.getNodes().has(counter));
	});
});
