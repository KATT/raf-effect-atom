import { describe, expect, it, vi } from "@effect/vitest";
import { screen } from "@testing-library/react";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import * as Schema from "effect/Schema";
import { createErrorBoundary } from "effect-atom-boundary";
import * as React from "react";

import { HydrationBoundary, Loader, useAtomResult } from "../src/index.ts";
import {
	click,
	mount,
	settle,
	silenceCaughtErrors,
} from "./fixtures/browser.tsx";
import { issue, IssueNotFound, Issues, serve } from "./fixtures/issues.ts";
import { load } from "./fixtures/server.ts";

const isIssueNotFound = Schema.is(IssueNotFound);

const [NotFoundBoundary, useNotFoundBoundary] = createErrorBoundary({
	catchTags: {
		IssueNotFound: (caught) => (
			<button onClick={caught.reset} type="button">
				{`No issue ${caught.error.id}${isIssueNotFound(caught.error) ? "" : " (not an IssueNotFound)"}`}
			</button>
		),
	},
	errors: Issues,
	name: "NotFound",
});

function Title(props: { readonly id: number }) {
	const result = useAtomResult(useNotFoundBoundary().wrap(issue(props.id)));
	if (AsyncResult.isSuccess(result)) {
		return <p>{result.value.title}</p>;
	}
	const error = AsyncResult.error(result);
	return (
		<p>{`Result: ${Option.isSome(error) ? error.value._tag : "defect"}`}</p>
	);
}

function UnclaimedTitle(props: { readonly id: number }) {
	const result = useAtomResult(issue(props.id));
	const error = AsyncResult.error(result);
	return (
		<p>{Option.isSome(error) ? `Result: ${error.value._tag}` : "Found"}</p>
	);
}

function Page(props: {
	readonly ids: ReadonlyArray<number>;
	readonly state?: Parameters<typeof HydrationBoundary>[0]["state"];
}) {
	return (
		<HydrationBoundary state={props.state}>
			<NotFoundBoundary>
				{props.ids.map((id) => (
					<React.Suspense fallback={<p>{`Loading ${id}`}</p>} key={id}>
						<Title id={id} />
					</React.Suspense>
				))}
			</NotFoundBoundary>
		</HydrationBoundary>
	);
}

const nodeOf = (app: ReturnType<typeof mount>, id: number) =>
	app.registry.getNodes().get(`AtomRpc:GetIssue:${id}`);

describe("useAtomResult after server rendering", () => {
	// React reports a conditional `use` once per page, so this runs first.
	it("calls use() again on the retry after a streamed result", async () => {
		using server = serve();
		using errors = vi.spyOn(console, "error");
		using rendered = await load(Loader.prefetch(issue(2)));
		using app = mount();
		await app.render(<Page ids={[2]} state={rendered.state} />);
		await settle(100);
		expect(screen.getByText("Issue 2")).toBeDefined();
		const reported = errors.mock.calls.flat().map(String);
		expect(reported.filter((message) => message.includes("use()"))).toEqual([]);
		expect(server.requests(2)).toBe(1);
	});

	it("catches a server-side IssueNotFound as an IssueNotFound", async () => {
		using server = serve({ 1: ["missing"] });
		using _errors = silenceCaughtErrors();
		using rendered = await load(Loader.ensure(issue(1)));
		using app = mount();
		await app.render(<Page ids={[1]} state={rendered.state} />);
		expect(screen.getByText("No issue 1")).toBeDefined();
		expect(server.requests(1)).toBe(1);
	});

	it("shows a hydrated success without requesting it again", async () => {
		using server = serve();
		using rendered = await load(Loader.ensure(issue(1)));
		using app = mount();
		await app.render(<Page ids={[1]} state={rendered.state} />, true);
		await settle(100);
		expect(screen.getByText("Issue 1")).toBeDefined();
		expect(server.requests(1)).toBe(1);
	});

	it("waits for a streamed result instead of requesting it", async () => {
		using server = serve();
		using rendered = await load(Loader.prefetch(issue(2)));
		using app = mount();
		await app.render(<Page ids={[2]} state={rendered.state} />, true);
		expect(screen.getByText("Issue 2")).toBeDefined();
		await settle(100);
		expect(server.requests(2)).toBe(1);
	});

	it("streams a typed failure as one too", async () => {
		using server = serve({ 3: ["missing"] });
		using _errors = silenceCaughtErrors();
		using rendered = await load(Loader.prefetch(issue(3)));
		using app = mount();
		await app.render(<Page ids={[3]} state={rendered.state} />);
		expect(screen.getByText("No issue 3")).toBeDefined();
		expect(server.requests(3)).toBe(1);
	});

	it("refreshes a hydrated failure on the boundary's reset", async () => {
		using server = serve({ 1: ["missing", "found"] });
		using _errors = silenceCaughtErrors();
		using rendered = await load(Loader.ensure(issue(1)));
		using app = mount();
		await app.render(<Page ids={[1]} state={rendered.state} />);
		await click("No issue 1");
		expect(screen.getByText("Issue 1")).toBeDefined();
		expect(server.requests(1)).toBe(2);
	});
});

/** A derived atom pointing at its source, as a boundary's wrapper is. */
const titled = Atom.family((id: number) =>
	Object.assign(
		Atom.transform(issue(id), (get) =>
			AsyncResult.map(get(issue(id)), (found) => ({
				...found,
				title: `Titled ${found.title}`,
			})),
		),
		{ initialValueTarget: issue(id) },
	),
);

function DerivedTitle(props: { readonly id: number }) {
	const result = useAtomResult(titled(props.id));
	return <p>{AsyncResult.isSuccess(result) ? result.value.title : "Failed"}</p>;
}

const DerivedPage = (props: {
	readonly id: number;
	readonly state?: Parameters<typeof HydrationBoundary>[0]["state"];
}) => (
	<HydrationBoundary state={props.state}>
		<React.Suspense fallback={<p>Loading</p>}>
			<DerivedTitle id={props.id} />
		</React.Suspense>
	</HydrationBoundary>
);

describe("useAtomResult on a derived atom", () => {
	it("reads its source's hydrated result, one request", async () => {
		using server = serve();
		using rendered = await load(Loader.ensure(issue(1)));
		using app = mount();
		await app.render(<DerivedPage id={1} state={rendered.state} />, true);
		await settle(100);
		expect(screen.getByText("Titled Issue 1")).toBeDefined();
		expect(server.requests(1)).toBe(1);
	});

	it("waits for its source's streamed result, one request", async () => {
		using server = serve();
		using rendered = await load(Loader.prefetch(issue(2)));
		using app = mount();
		await app.render(<DerivedPage id={2} state={rendered.state} />, true);
		await settle(100);
		expect(screen.getByText("Titled Issue 2")).toBeDefined();
		expect(server.requests(2)).toBe(1);
	});

	it("ends the loader's lease on its source", async () => {
		using server = serve();
		using app = mount();
		Loader.make(app.registry).prefetch(issue(3));
		await app.render(<DerivedPage id={3} />);
		expect(screen.getByText("Titled Issue 3")).toBeDefined();
		await app.unmount();
		await settle(2000);
		expect(nodeOf(app, 3)).toBeUndefined();
		expect(server.requests(3)).toBe(1);
	});
});

describe("useAtomResult", () => {
	it("throws a defect to the error boundaries above", async () => {
		using _server = serve({ 1: ["crash"] });
		using _errors = silenceCaughtErrors();
		using app = mount();
		await app.render(
			<React.Suspense fallback={<p>Loading</p>}>
				<UnclaimedTitle id={1} />
			</React.Suspense>,
		);
		expect(screen.getByText(/^Outer: .*the server crashed/)).toBeDefined();
	});

	it("returns a typed failure", async () => {
		using _server = serve({ 1: ["missing"] });
		using app = mount();
		await app.render(
			<React.Suspense fallback={<p>Loading</p>}>
				<UnclaimedTitle id={1} />
			</React.Suspense>,
		);
		expect(screen.getByText("Result: IssueNotFound")).toBeDefined();
	});

	it("returns a failure the boundary above doesn't claim", async () => {
		using _server = serve({ 1: ["signed-out"] });
		using app = mount();
		await app.render(<Page ids={[1]} />);
		expect(screen.getByText("Result: Unauthorized")).toBeDefined();
	});

	it("takes over a loader's atom, ending its lease", async () => {
		using server = serve();
		using app = mount();
		Loader.make(app.registry).prefetch(issue(1));
		await app.render(<Page ids={[1]} />);
		expect(screen.getByText("Issue 1")).toBeDefined();
		await app.unmount();
		await settle(2000);
		expect(nodeOf(app, 1)).toBeUndefined();
		expect(server.requests(1)).toBe(1);
	});

	it("leaves the atom to its lease until a component mounts it", async () => {
		using _server = serve();
		using app = mount();
		Loader.make(app.registry).prefetch(issue(1));
		await settle(1500);
		expect(nodeOf(app, 1)).toBeDefined();
	});

	it("reads a loader's settled result without requesting it again", async () => {
		using server = serve();
		using app = mount();
		await Effect.runPromise(
			Effect.promise(() => Loader.make(app.registry).ensure(issue(1))),
		);
		await app.render(<Page ids={[1]} />, true);
		expect(screen.getByText("Issue 1")).toBeDefined();
		expect(server.requests(1)).toBe(1);
	});
});
