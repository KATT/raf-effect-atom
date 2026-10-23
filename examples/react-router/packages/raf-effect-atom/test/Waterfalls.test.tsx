import { describe, expect, it, vi } from "@effect/vitest";
import { screen } from "@testing-library/react";
import * as Effect from "effect/Effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import { createErrorBoundary } from "effect-atom-boundary";
import * as React from "react";

import {
	HydrationBoundary,
	Loader,
	useAtomResult,
	useWaterfall,
	WaterfallDetection,
	type WaterfallMode,
} from "../src/index.ts";
import { mount, settle, silenceCaughtErrors } from "./fixtures/browser.tsx";
import { issue, Issues, serve } from "./fixtures/issues.ts";
import { load } from "./fixtures/server.ts";

const spyOnWarnings = () =>
	vi.spyOn(console, "warn").mockImplementation(() => {});

type IssueAtom = ReturnType<typeof issue>;

function Title(props: { readonly atom: IssueAtom }) {
	const result = useAtomResult(props.atom);
	return (
		<p>{AsyncResult.isSuccess(result) ? result.value.title : "Not found"}</p>
	);
}

function WaterfallTitle(props: { readonly id: number }) {
	const result = useAtomResult(useWaterfall(issue(props.id)));
	return (
		<p>{AsyncResult.isSuccess(result) ? result.value.title : "Not found"}</p>
	);
}

const titleOf = Atom.family((id: number) =>
	Atom.map(issue(id), (result) =>
		AsyncResult.map(result, (found) => found.title),
	),
);

function DerivedTitle(props: { readonly id: number }) {
	const result = useAtomResult(titleOf(props.id));
	return <p>{AsyncResult.isSuccess(result) ? result.value : "Not found"}</p>;
}

const [NotFoundBoundary, useNotFoundBoundary] = createErrorBoundary({
	catchTags: { IssueNotFound: () => <p>No issue</p> },
	errors: Issues,
	name: "NotFound",
});

function WrappedTitle(props: { readonly id: number }) {
	const result = useAtomResult(useNotFoundBoundary().wrap(issue(props.id)));
	return (
		<p>{AsyncResult.isSuccess(result) ? result.value.title : "Not found"}</p>
	);
}

function Page(props: {
	readonly children: React.ReactNode;
	readonly mode?: WaterfallMode;
	readonly state?: Parameters<typeof HydrationBoundary>[0]["state"];
}) {
	const page = (
		<HydrationBoundary state={props.state}>
			<React.Suspense fallback={<p>Loading</p>}>
				{props.children}
			</React.Suspense>
		</HydrationBoundary>
	);
	return props.mode === undefined ? (
		page
	) : (
		<WaterfallDetection mode={props.mode}>{page}</WaterfallDetection>
	);
}

describe("useAtomResult's waterfall check", () => {
	it("warns once when a read starts an atom nothing started", async () => {
		using _server = serve();
		const warnings = spyOnWarnings();
		using app = mount();
		await app.render(
			<Page>
				<Title atom={issue(1)} />
			</Page>,
			true,
		);
		await settle();
		expect(screen.getByText("Issue 1")).toBeDefined();
		expect(warnings).toHaveBeenCalledOnce();
		const [message] = warnings.mock.calls[0] ?? [];
		expect(message).toContain("AtomRpc:GetIssue:1");
		expect(message).toContain("request waterfall");
		expect(message).toContain("useWaterfall");
	});

	it("doesn't warn for an atom a loader started", async () => {
		using server = serve();
		const warnings = spyOnWarnings();
		using app = mount();
		Loader.make(app.registry).prefetch(issue(1));
		await app.render(
			<Page>
				<Title atom={issue(1)} />
			</Page>,
		);
		await settle();
		expect(screen.getByText("Issue 1")).toBeDefined();
		expect(warnings).not.toHaveBeenCalled();
		expect(server.requests(1)).toBe(1);
	});

	it("doesn't warn for a hydrated or a streamed result", async () => {
		using _server = serve();
		const warnings = spyOnWarnings();
		using rendered = await load(
			Effect.andThen(Loader.prefetch(issue(2)), Loader.ensure(issue(1))),
		);
		using app = mount();
		await app.render(
			<Page state={rendered.state}>
				<Title atom={issue(1)} />
				<Title atom={issue(2)} />
			</Page>,
		);
		await settle(100);
		expect(screen.getByText("Issue 1")).toBeDefined();
		expect(screen.getByText("Issue 2")).toBeDefined();
		expect(warnings).not.toHaveBeenCalled();
	});

	it("doesn't warn for a derived atom over one a loader started", async () => {
		using _server = serve();
		const warnings = spyOnWarnings();
		using app = mount();
		Loader.make(app.registry).prefetch(issue(1));
		await app.render(
			<Page>
				<DerivedTitle id={1} />
			</Page>,
		);
		await settle();
		expect(screen.getByText("Issue 1")).toBeDefined();
		expect(warnings).not.toHaveBeenCalled();
	});

	it("checks the source of a boundary's wrapper", async () => {
		using _server = serve();
		const warnings = spyOnWarnings();
		using app = mount();
		Loader.make(app.registry).prefetch(issue(1));
		await app.render(
			<Page>
				<NotFoundBoundary>
					<WrappedTitle id={1} />
					<WrappedTitle id={2} />
				</NotFoundBoundary>
			</Page>,
		);
		await settle();
		expect(screen.getByText("Issue 1")).toBeDefined();
		expect(screen.getByText("Issue 2")).toBeDefined();
		expect(warnings).toHaveBeenCalledOnce();
		expect(warnings.mock.calls[0]?.[0]).toContain("read AtomRpc:GetIssue:2 ");
	});

	it("names the source a derived read started", async () => {
		using _server = serve();
		const warnings = spyOnWarnings();
		using app = mount();
		await app.render(
			<Page>
				<DerivedTitle id={2} />
			</Page>,
		);
		await settle();
		expect(warnings).toHaveBeenCalledOnce();
		expect(warnings.mock.calls[0]?.[0]).toContain(
			"which started AtomRpc:GetIssue:2",
		);
	});

	it("throws to the error boundary in throw mode", async () => {
		using _server = serve();
		using _errors = silenceCaughtErrors();
		using app = mount();
		await app.render(
			<Page mode="throw">
				<Title atom={issue(1)} />
			</Page>,
		);
		expect(
			screen.getByText(/^Outer: Error: raf-effect-atom: rendering read/),
		).toBeDefined();
	});

	it("doesn't check in off mode", async () => {
		using _server = serve();
		const warnings = spyOnWarnings();
		using app = mount();
		await app.render(
			<Page mode="off">
				<Title atom={issue(1)} />
			</Page>,
		);
		await settle();
		expect(screen.getByText("Issue 1")).toBeDefined();
		expect(warnings).not.toHaveBeenCalled();
	});
});

describe("useWaterfall", () => {
	it("starts the atom once, without a warning, even in throw mode", async () => {
		using server = serve();
		using app = mount();
		await app.render(
			<Page mode="throw">
				<WaterfallTitle id={1} />
			</Page>,
			true,
		);
		await settle();
		expect(screen.getByText("Issue 1")).toBeDefined();
		expect(server.requests(1)).toBe(1);
	});

	it("waits for a streamed result instead of starting it again", async () => {
		using server = serve();
		using rendered = await load(Loader.prefetch(issue(2)));
		using app = mount();
		await app.render(
			<Page mode="throw" state={rendered.state}>
				<WaterfallTitle id={2} />
			</Page>,
		);
		await settle(100);
		expect(screen.getByText("Issue 2")).toBeDefined();
		expect(server.requests(2)).toBe(1);
	});

	it("hands the atom to the component, so it goes idle on unmount", async () => {
		using _server = serve();
		using app = mount();
		await app.render(
			<Page>
				<WaterfallTitle id={3} />
			</Page>,
		);
		await settle();
		await app.unmount();
		await settle(1500);
		expect(app.registry.getNodes().has("AtomRpc:GetIssue:3")).toBe(false);
	});
});
