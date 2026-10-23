// @vitest-environment node
import { RegistryContext } from "@effect/atom-react";
import { describe, expect, it } from "@effect/vitest";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type * as EffectHydration from "effect/reactivity/Hydration";
import * as React from "react";
import { renderToReadableStream, renderToString } from "react-dom/server";

import {
	type Handle,
	Hydration,
	HydrationBoundary,
	Loader,
	RequestRegistry,
	useAtomResult,
} from "../src/index.ts";
import { RegistryProvider } from "../src/Next.ts";
import { makeRegistry } from "../src/TanStackRouter.tsx";
import { issue, serve, unloaded } from "./fixtures/issues.ts";
import { load } from "./fixtures/server.ts";
import { wire } from "./fixtures/wire.ts";

const disposable = (registry: AtomRegistry.AtomRegistry) => ({
	registry,
	[Symbol.dispose]: () => registry.dispose(),
});

/**
 * Holds server renders until every request it lets in waits at it, so they
 * render their pages at the same time.
 */
const makeGate = (requests: number) => {
	const open = Promise.withResolvers<void>();
	const waiting = new Set<string>();
	function Gate(props: {
		readonly children?: React.ReactNode;
		readonly request: string;
	}) {
		waiting.add(props.request);
		if (waiting.size === requests) {
			open.resolve();
		}
		React.use(open.promise);
		return props.children;
	}
	return Gate;
};

function Title(props: { readonly issue: Handle<typeof issue> }) {
	const result = useAtomResult(issue, props.issue);
	return <p>{AsyncResult.isSuccess(result) ? result.value.title : "Failed"}</p>;
}

const page = (
	registry: AtomRegistry.AtomRegistry,
	handle: Handle<typeof issue>,
) => (
	<RegistryContext.Provider value={registry}>
		<React.Suspense fallback={<p>Loading</p>}>
			<Title issue={handle} />
		</React.Suspense>
	</RegistryContext.Provider>
);

describe("useAtomResult on the server", () => {
	it("renders a loader's result from the request registry", async () => {
		using server = serve();
		using rendered = await load(Loader.ensure(issue, 1));
		expect(renderToString(page(rendered.registry, rendered.handles))).toContain(
			"Issue 1",
		);
		expect(server.requests(1)).toBe(1);
	});

	it("throws in development without a request registry", () => {
		using server = serve();
		const registry = AtomRegistry.make();
		const outsideSuspense = (
			<RegistryContext.Provider value={registry}>
				<Title issue={unloaded(1)} />
			</RegistryContext.Provider>
		);
		expect(() => renderToString(outsideSuspense)).toThrow(
			"without a request registry",
		);
		expect(server.requests(1)).toBe(0);
		registry.dispose();
	});
});

/** Says whether it reads `source` or another registry. */
const Reads = (props: { readonly source: AtomRegistry.AtomRegistry }) => (
	<p>
		{React.useContext(RegistryContext) === props.source ? "source" : "nearest"}
	</p>
);

describe("HydrationBoundary on the server", () => {
	const render = (
		state: Iterable<EffectHydration.DehydratedAtom>,
		source: AtomRegistry.AtomRegistry,
	) => {
		const nearest = RequestRegistry.make();
		const html = renderToString(
			<RegistryContext.Provider value={nearest}>
				<HydrationBoundary state={state}>
					<Reads source={source} />
				</HydrationBoundary>
			</RegistryContext.Provider>,
		);
		nearest.dispose();
		return html;
	};

	it("reads the registry the loader data's state came from", async () => {
		using _server = serve();
		using loaded = await load(Loader.ensure(issue, 1));
		const state = Hydration.dehydrate(loaded.registry);
		expect(render(state, loaded.registry)).toContain("source");
	});

	it("hydrates the nearest registry with state that crossed a wire", async () => {
		using _server = serve();
		using loaded = await load(Loader.ensure(issue, 1));
		expect(render(loaded.state, loaded.registry)).toContain("nearest");
	});

	it("throws in development without a request registry", async () => {
		using _server = serve();
		using loaded = await load(Loader.ensure(issue, 1));
		const shared = AtomRegistry.make();
		expect(() =>
			renderToString(
				<RegistryContext.Provider value={shared}>
					<HydrationBoundary state={loaded.state} />
				</RegistryContext.Provider>,
			),
		).toThrow(
			"HydrationBoundary rendered on the server without a request registry",
		);
		expect(shared.preloadedSerializable.size).toBe(0);
		shared.dispose();
	});
});

describe("two overlapping requests", () => {
	/**
	 * Streams one request's page into its own nearest request registry, as a
	 * framework's server render does, until every result has arrived.
	 */
	const stream = async (
		Gate: ReturnType<typeof makeGate>,
		request: string,
		state: Iterable<EffectHydration.DehydratedAtom>,
		handle: Handle<typeof issue>,
	) => {
		using nearest = disposable(RequestRegistry.make());
		const html = await renderToReadableStream(
			<RegistryContext.Provider value={nearest.registry}>
				<HydrationBoundary state={state}>
					<React.Suspense fallback={<p>Loading</p>}>
						<Gate request={request}>
							<Title issue={handle} />
						</Gate>
					</React.Suspense>
				</HydrationBoundary>
			</RegistryContext.Provider>,
		);
		await html.allReady;
		return await new Response(html).text();
	};

	it.each([
		{
			path: "the loader data's own array",
			state: (registry: AtomRegistry.AtomRegistry) =>
				Hydration.dehydrate(registry),
		},
		{
			path: "state that crossed a wire",
			state: (registry: AtomRegistry.AtomRegistry) =>
				wire(Hydration.dehydrate(registry)),
		},
	])("stream their own results ($path)", async (each) => {
		// The first request's prefetch fails, the second's finds the issue.
		using server = serve({ 1: ["missing", "found"] });
		using missing = await load(Loader.prefetch(issue, 1));
		using found = await load(Loader.prefetch(issue, 1));
		const Gate = makeGate(2);
		const [missingHtml, foundHtml] = await Promise.all([
			stream(Gate, "missing", each.state(missing.registry), missing.handles),
			stream(Gate, "found", each.state(found.registry), found.handles),
		]);
		expect(missingHtml).toContain("Failed");
		expect(missingHtml).not.toContain("Issue 1");
		expect(foundHtml).toContain("Issue 1");
		expect(foundHtml).not.toContain("Failed");
		expect(server.requests(1)).toBe(2);
	});
});

describe("makeRegistry on the server", () => {
	it("makes a request registry where there's no window", () => {
		const registry = makeRegistry();
		expect(RequestRegistry.isRequestRegistry(registry)).toBe(true);
		registry.dispose();
	});
});

describe("raf-effect-atom/next's RegistryProvider on the server", () => {
	it("renders client components with a request registry", () => {
		using server = serve();
		const tree = (
			<RegistryProvider>
				<React.Suspense fallback={<p>Loading</p>}>
					<Title issue={unloaded(1)} />
				</React.Suspense>
			</RegistryProvider>
		);
		expect(renderToString(tree)).toContain("Loading");
		expect(server.requests(1)).toBe(1);
	});
});
