import { assert, describe, it } from "@effect/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import * as Option from "effect/Option";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as Schema from "effect/Schema";
import * as React from "react";

import {
	type Handle,
	HydrationBoundary,
	Loader,
	RegistryProvider,
	RequestRegistry,
	useAtomResult,
} from "../src/index.ts";
import { settle } from "./fixtures/browser.tsx";
import { issue, IssueNotFound, serve } from "./fixtures/issues.ts";
import { load } from "./fixtures/server.ts";

const isIssueNotFound = Schema.is(IssueNotFound);

const disposable = (registry: AtomRegistry.AtomRegistry) => ({
	[Symbol.dispose]: () => registry.dispose(),
	value: registry,
});

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

const renderPage = async (
	handle: Handle<typeof issue>,
	state: Parameters<typeof HydrationBoundary>[0]["state"],
) => {
	await act(async () => {
		render(
			<RegistryProvider>
				<HydrationBoundary state={state}>
					<React.Suspense fallback={<p>Loading</p>}>
						<Title issue={handle} />
					</React.Suspense>
				</HydrationBoundary>
			</RegistryProvider>,
		);
	});
	await settle();
	return { [Symbol.dispose]: cleanup };
};

describe("raf-effect-atom/rsc in the browser", () => {
	it("hydrates a server-side IssueNotFound as an IssueNotFound", async () => {
		using server = serve({ 1: ["missing"] });
		using rendered = await load(Loader.ensure(issue, 1));
		using _page = await renderPage(rendered.handles, rendered.state);
		assert.isDefined(screen.getByText("IssueNotFound 1"));
		assert.strictEqual(server.requests(1), 1);
	});

	it("waits for a streamed result instead of requesting it again", async () => {
		using server = serve({});
		using rendered = await load(Loader.prefetch(issue, 2));
		using _page = await renderPage(rendered.handles, rendered.state);
		assert.isDefined(screen.getByText("Issue 2"));
		assert.strictEqual(server.requests(2), 1);
	});

	it("throws for a registry, which only the server components' build takes", () => {
		using registry = disposable(RequestRegistry.make());
		assert.throws(
			() => HydrationBoundary({ registry: registry.value }),
			/`registry` works only in server components/,
		);
	});
});
