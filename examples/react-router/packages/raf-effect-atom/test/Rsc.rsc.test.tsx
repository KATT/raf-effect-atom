import { assert, describe, it, vi } from "@effect/vitest";
import * as Option from "effect/Option";
import * as Predicate from "effect/Predicate";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type * as EffectHydration from "effect/reactivity/Hydration";
import * as Schema from "effect/Schema";
import * as React from "react";
import { createFromReadableStream } from "react-server-dom-webpack/client";
import {
	registerClientReference,
	renderToReadableStream,
} from "react-server-dom-webpack/server";

import type { LoadedHandle } from "../src/Handle.ts";
import {
	Hydration,
	HydrationBoundary,
	Loader,
	RequestRegistry,
	useAtomResult,
} from "../src/index.react-server.ts";
import * as Pending from "../src/internal/pending.ts";
import * as RscInternal from "../src/internal/rsc.ts";
import { HydrationBoundary as ServerHydrationBoundary } from "../src/ReactHydration.react-server.tsx";
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

/** A client component of the app that reads an issue's handle. */
const IssueTitle = registerClientReference(
	(_props: { readonly issue: LoadedHandle<typeof issue> }): React.ReactNode => {
		throw new Error("a client component rendered on the server");
	},
	"app/issue-title",
	"IssueTitle",
);

/** A bundler's metadata for `id#name`: a module with no chunks to load. */
const metadataOf = (key: string | symbol) => {
	const [id, name] = String(key).split("#");
	return { chunks: [], id, name };
};

/**
 * The client manifest of the server render, for every client reference:
 * this package's `"use client"` modules (`vite.config.ts` makes their
 * exports references) and the app's.
 */
const clientManifest = new Proxy({}, { get: (_, key) => metadataOf(key) });

/** The browser's module map, for every client reference. */
const moduleMap = new Proxy(
	{},
	{
		get: (_, id) =>
			new Proxy(
				{},
				{ get: (__, name) => metadataOf(`${String(id)}#${String(name)}`) },
			),
	},
);

/** Every client module, as the browser loads it: components that render nothing. */
const clientModule = new Proxy({}, { get: () => () => null });

const render = (page: React.ReactNode) =>
	renderToReadableStream(page, clientManifest);

/** Decodes a server component payload as the browser does, as it arrives. */
const decode = async (payload: ReadableStream<Uint8Array>) => {
	const element: React.ReactElement<{
		readonly state: ReadonlyArray<EffectHydration.DehydratedAtom>;
	}> = await createFromReadableStream(payload, {
		serverConsumerManifest: {
			moduleLoading: null,
			moduleMap,
			serverModuleMap: null,
		},
	});
	return element.props.state;
};

/**
 * Renders a server component tree to React's server component payload, as
 * Next.js does for one request, and decodes it once all of it has arrived.
 */
const renderPayload = async (page: React.ReactNode) => {
	const payload = await new Response(render(page)).text();
	return { payload, state: await decode(new Response(payload).body!) };
};

const streamOf = (entry: EffectHydration.DehydratedAtom) =>
	"resultPromise" in entry ? entry.resultPromise : undefined;

const Rsc = RscInternal.make();

const resultOf = (registry: AtomRegistry.AtomRegistry, id: number) =>
	registry.get(Hydration.hydrated(issue(id)));

describe("raf-effect-atom under the react-server condition", () => {
	it("gives server components the server HydrationBoundary, and client references for the client APIs", () => {
		assert.strictEqual(HydrationBoundary, ServerHydrationBoundary);
		assert.isTrue(
			Predicate.hasProperty(useAtomResult, "$$typeof") &&
				useAtomResult.$$typeof === Symbol.for("react.client.reference"),
		);
	});
});

describe("raf-effect-atom/rsc in a server component render", () => {
	it("sends a server-side IssueNotFound that hydrates as an IssueNotFound", async () => {
		using server = serve({ 1: ["missing"] });
		vi.stubGlobal("__webpack_require__", () => clientModule);
		async function IssuePage() {
			await Rsc.ensure(issue, 1);
			return <HydrationBoundary registry={Rsc.getRegistry()} />;
		}
		const rendered = await renderPayload(<IssuePage />);
		const registry = AtomRegistry.make();
		Hydration.hydrate(registry, rendered.state);
		const result = resultOf(registry, 1);
		assert.isTrue(AsyncResult.isFailure(result));
		const error = AsyncResult.error(result);
		assert.isTrue(
			Option.isSome(error) && Schema.is(IssueNotFound)(error.value),
		);
		assert.strictEqual(server.requests(1), 1);
		registry.dispose();
	});

	it("streams a prefetched result as a promise in the payload", async () => {
		using server = serve({});
		vi.stubGlobal("__webpack_require__", () => clientModule);
		async function IssuePage() {
			Rsc.prefetch(issue, 2);
			return <HydrationBoundary registry={Rsc.getRegistry()} />;
		}
		const rendered = await renderPayload(<IssuePage />);
		assert.match(rendered.payload, /"resultPromise":"\$@\w+"/);
		const registry = AtomRegistry.make();
		Hydration.hydrate(registry, rendered.state);
		await Promise.all(rendered.state.map(streamOf));
		const result = resultOf(registry, 2);
		assert.isTrue(
			AsyncResult.isSuccess(result) && result.value.title === "Issue 2",
		);
		assert.strictEqual(server.requests(2), 1);
		registry.dispose();
	});

	it("holds a prefetched result that's still streaming, so the browser waits for it", async () => {
		using server = serve({});
		vi.stubGlobal("__webpack_require__", () => clientModule);
		async function IssuePage() {
			Rsc.prefetch(issue, 4);
			return <HydrationBoundary registry={Rsc.getRegistry()} />;
		}
		const registry = AtomRegistry.make();
		Hydration.hydrate(registry, await decode(render(<IssuePage />)));
		const streamed = Pending.get(registry, "AtomRpc:GetIssue:4");
		assert.instanceOf(streamed, Promise);
		await streamed;
		const result = resultOf(registry, 4);
		assert.isTrue(
			AsyncResult.isSuccess(result) && result.value.title === "Issue 4",
		);
		assert.strictEqual(server.requests(4), 1);
		registry.dispose();
	});

	it("shares one registry per render and disposes it when the render finishes", async () => {
		using _server = serve({});
		vi.stubGlobal("__webpack_require__", () => clientModule);
		const seen: Array<AtomRegistry.AtomRegistry> = [];
		function Comments() {
			seen.push(Rsc.getRegistry());
			return null;
		}
		async function IssuePage() {
			seen.push(Rsc.getRegistry());
			Rsc.prefetch(issue, 3);
			return (
				<HydrationBoundary registry={Rsc.getRegistry()}>
					<Comments />
				</HydrationBoundary>
			);
		}
		await renderPayload(<IssuePage />);
		await renderPayload(<IssuePage />);
		assert.strictEqual(seen.length, 4);
		assert.strictEqual(seen[0], seen[1]);
		assert.notStrictEqual(seen[1], seen[2]);
		for (const registry of seen) {
			assert.throws(() => registry.get(counter), /disposed/);
		}
	});

	it("seeds each render's registry, and dehydrates what started while an async seed ran", async () => {
		vi.stubGlobal("__webpack_require__", () => clientModule);
		const seeded = RscInternal.make({
			seed: async (registry) => {
				await later(10);
				registry.set(viewer, "ada");
			},
		});
		async function GreetingPage() {
			seeded.prefetch(greeting);
			return <HydrationBoundary registry={seeded.getRegistry()} />;
		}
		const rendered = await renderPayload(<GreetingPage />);
		const registry = AtomRegistry.make();
		Hydration.hydrate(registry, rendered.state);
		await Promise.all(rendered.state.map(streamOf));
		const result = registry.get(Hydration.hydrated(greeting));
		assert.isTrue(
			AsyncResult.isSuccess(result) && result.value === "Hello, ada",
		);
		registry.dispose();
	});

	it("stops a server component's wait when React aborts the render", async () => {
		vi.stubGlobal("__webpack_require__", () => clientModule);
		const gate = gated("rsc-signal");
		const waited =
			Promise.withResolvers<
				PromiseSettledResult<LoadedHandle<typeof gate.atom>>
			>();
		async function GatedPage() {
			const [settled] = await Promise.allSettled([Rsc.ensure(gate.atom)]);
			waited.resolve(settled);
			return null;
		}
		const controller = new AbortController();
		const payload = renderToReadableStream(
			<GatedPage />,
			{},
			{ onError: () => undefined, signal: controller.signal },
		);
		const reading = new Response(payload).text().catch(() => "");
		await later(5);
		const reason = new Error("the browser left");
		controller.abort(reason);
		const settled = await waited.promise;
		assert.strictEqual(settled.status, "rejected");
		assert.strictEqual(
			settled.status === "rejected" ? settled.reason : undefined,
			reason,
		);
		await reading;
	});

	it("passes a dehydrated state on", async () => {
		using server = serve({});
		vi.stubGlobal("__webpack_require__", () => clientModule);
		const loaded = RequestRegistry.make();
		await Loader.make(loaded).ensure(issue, 5);
		const rendered = await renderPayload(
			<HydrationBoundary state={Hydration.dehydrate(loaded)} />,
		);
		loaded.dispose();
		const registry = AtomRegistry.make();
		Hydration.hydrate(registry, rendered.state);
		const result = resultOf(registry, 5);
		assert.isTrue(
			AsyncResult.isSuccess(result) && result.value.title === "Issue 5",
		);
		assert.strictEqual(server.requests(5), 1);
		registry.dispose();
	});

	it("refuses a registry that isn't a request registry", async () => {
		const errors: Array<unknown> = [];
		const registry = AtomRegistry.make();
		const payload = renderToReadableStream(
			<HydrationBoundary registry={registry} />,
			{},
			{ onError: (error) => void errors.push(error) },
		);
		await new Response(payload).text();
		assert.match(String(errors[0]), /isn't a request registry/);
		registry.dispose();
	});

	it("sends a verb's handle to a client component as a prop", async () => {
		using _server = serve({});
		vi.stubGlobal("__webpack_require__", () => clientModule);
		async function IssuePage() {
			return <IssueTitle issue={await Rsc.ensure(issue, 1)} />;
		}
		const element: React.ReactElement<{
			readonly issue: LoadedHandle<typeof issue>;
		}> = await createFromReadableStream(render(<IssuePage />), {
			serverConsumerManifest: {
				moduleLoading: null,
				moduleMap,
				serverModuleMap: null,
			},
		});
		assert.deepStrictEqual(element.props.issue, {
			args: [1],
			key: "AtomRpc:GetIssue:1",
			loaded: true,
		});
	});
});
