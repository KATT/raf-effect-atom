import { assert, describe, it, vi } from "@effect/vitest";
import * as Option from "effect/Option";
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
import * as Hydration from "../src/Hydration.ts";
import * as Next from "../src/internal/next.ts";
import * as Pending from "../src/internal/pending.ts";
import { counter, issue, IssueNotFound, serve } from "./fixtures/issues.ts";

const reference = {
	chunks: [],
	id: "raf-effect-atom/next",
	name: "HydrateAtoms",
};

/**
 * `raf-effect-atom/next`'s `HydrateAtoms`, as a bundler hands it to server
 * components: a reference to the client module, which never runs here.
 */
const HydrateAtoms = registerClientReference(
	(_props: {
		readonly children?: React.ReactNode;
		readonly state: ReadonlyArray<EffectHydration.DehydratedAtom>;
	}): React.ReactNode => {
		throw new Error("a client component rendered on the server");
	},
	reference.id,
	reference.name,
);

const titleReference = {
	chunks: [],
	id: "app/issue-title",
	name: "IssueTitle",
};

/** A client component of the app that reads an issue's handle. */
const IssueTitle = registerClientReference(
	(_props: { readonly issue: LoadedHandle<typeof issue> }): React.ReactNode => {
		throw new Error("a client component rendered on the server");
	},
	titleReference.id,
	titleReference.name,
);

const clientModule = { [reference.name]: () => null };

const render = (page: React.ReactNode) =>
	renderToReadableStream(page, {
		[`${reference.id}#${reference.name}`]: reference,
		[`${titleReference.id}#${titleReference.name}`]: titleReference,
	});

/** Decodes a server component payload as the browser does, as it arrives. */
const decode = async (payload: ReadableStream<Uint8Array>) => {
	const element: React.ReactElement<{
		readonly state: ReadonlyArray<EffectHydration.DehydratedAtom>;
	}> = await createFromReadableStream(payload, {
		serverConsumerManifest: {
			moduleLoading: null,
			moduleMap: { [reference.id]: { [reference.name]: reference } },
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

const resultOf = (registry: AtomRegistry.AtomRegistry, id: number) =>
	registry.get(Hydration.hydrated(issue(id)));

describe("raf-effect-atom/next in a server component render", () => {
	it("sends a server-side IssueNotFound that hydrates as an IssueNotFound", async () => {
		using server = serve({ 1: ["missing"] });
		vi.stubGlobal("__webpack_require__", () => clientModule);
		async function IssuePage() {
			await Next.ensure(issue, 1);
			return <HydrateAtoms state={Next.dehydrate()} />;
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
		function IssuePage() {
			Next.prefetch(issue, 2);
			return <HydrateAtoms state={Next.dehydrate()} />;
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
		function IssuePage() {
			Next.prefetch(issue, 4);
			return <HydrateAtoms state={Next.dehydrate()} />;
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
			seen.push(Next.getRegistry());
			return null;
		}
		function IssuePage() {
			seen.push(Next.getRegistry());
			Next.prefetch(issue, 3);
			return (
				<HydrateAtoms state={Next.dehydrate()}>
					<Comments />
				</HydrateAtoms>
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

	it("sends a verb's handle to a client component as a prop", async () => {
		using _server = serve({});
		vi.stubGlobal("__webpack_require__", () => ({
			[titleReference.name]: () => null,
		}));
		async function IssuePage() {
			return <IssueTitle issue={await Next.ensure(issue, 1)} />;
		}
		const element: React.ReactElement<{
			readonly issue: LoadedHandle<typeof issue>;
		}> = await createFromReadableStream(render(<IssuePage />), {
			serverConsumerManifest: {
				moduleLoading: null,
				moduleMap: {
					[titleReference.id]: { [titleReference.name]: titleReference },
				},
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
