// @vitest-environment node
import { RegistryContext } from "@effect/atom-react";
import { describe, expect, it } from "@effect/vitest";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type * as EffectHydration from "effect/reactivity/Hydration";
import * as React from "react";
import { renderToString } from "react-dom/server";

import {
	Hydration,
	HydrationBoundary,
	Loader,
	RequestRegistry,
	useAtomResult,
} from "../src/index.ts";
import { RegistryProvider } from "../src/Next.ts";
import { makeRegistry } from "../src/TanStackRouter.tsx";
import { issue, serve } from "./fixtures/issues.ts";
import { load } from "./fixtures/server.ts";

function Title(props: { readonly id: number }) {
	const result = useAtomResult(issue(props.id));
	return <p>{AsyncResult.isSuccess(result) ? result.value.title : "Failed"}</p>;
}

const page = (registry: AtomRegistry.AtomRegistry) => (
	<RegistryContext.Provider value={registry}>
		<React.Suspense fallback={<p>Loading</p>}>
			<Title id={1} />
		</React.Suspense>
	</RegistryContext.Provider>
);

describe("useAtomResult on the server", () => {
	it("renders a loader's result from the request registry", async () => {
		using server = serve();
		using rendered = await load(Loader.ensure(issue(1)));
		expect(renderToString(page(rendered.registry))).toContain("Issue 1");
		expect(server.requests(1)).toBe(1);
	});

	it("throws in development without a request registry", () => {
		using server = serve();
		const registry = AtomRegistry.make();
		const outsideSuspense = (
			<RegistryContext.Provider value={registry}>
				<Title id={1} />
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
		using loaded = await load(Loader.ensure(issue(1)));
		const state = Hydration.dehydrate(loaded.registry);
		expect(render(state, loaded.registry)).toContain("source");
	});

	it("hydrates the nearest registry with state that crossed a wire", async () => {
		using _server = serve();
		using loaded = await load(Loader.ensure(issue(1)));
		expect(render(loaded.state, loaded.registry)).toContain("nearest");
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
					<Title id={1} />
				</React.Suspense>
			</RegistryProvider>
		);
		expect(renderToString(tree)).toContain("Loading");
		expect(server.requests(1)).toBe(1);
	});
});
