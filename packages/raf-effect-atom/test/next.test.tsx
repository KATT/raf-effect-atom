import { assert, describe, it } from "@effect/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import * as Option from "effect/Option";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Schema from "effect/Schema";
import * as React from "react";

import { Loader, useAtomResult } from "../src/index.ts";
import { HydrateAtoms, RegistryProvider } from "../src/next.ts";
import { settle } from "./fixtures/browser.tsx";
import { issue, IssueNotFound, serve } from "./fixtures/issues.ts";
import { load } from "./fixtures/server.ts";

const isIssueNotFound = Schema.is(IssueNotFound);

function Title(props: { readonly id: number }) {
	const result = useAtomResult(issue(props.id));
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
	id: number,
	state: Parameters<typeof HydrateAtoms>[0]["state"],
) => {
	await act(async () => {
		render(
			<RegistryProvider>
				<HydrateAtoms state={state}>
					<React.Suspense fallback={<p>Loading</p>}>
						<Title id={id} />
					</React.Suspense>
				</HydrateAtoms>
			</RegistryProvider>,
		);
	});
	await settle();
	return { [Symbol.dispose]: cleanup };
};

describe("raf-effect-atom/next in the browser", () => {
	it("hydrates a server-side IssueNotFound as an IssueNotFound", async () => {
		using server = serve({ 1: ["missing"] });
		using rendered = await load(Loader.ensure(issue(1)));
		using _page = await renderPage(1, rendered.state);
		assert.isDefined(screen.getByText("IssueNotFound 1"));
		assert.strictEqual(server.requests(1), 1);
	});

	it("waits for a streamed result instead of requesting it again", async () => {
		using server = serve({});
		using rendered = await load(Loader.prefetch(issue(2)));
		using _page = await renderPage(2, rendered.state);
		assert.isDefined(screen.getByText("Issue 2"));
		assert.strictEqual(server.requests(2), 1);
	});
});
