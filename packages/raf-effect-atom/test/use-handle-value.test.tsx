import { describe, expect, it, vi } from "@effect/vitest";
import { act, screen } from "@testing-library/react";
import * as Option from "effect/Option";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as React from "react";

import {
	type Handle,
	HydrationBoundary,
	Loader,
	useHandleValue,
	WaterfallDetection,
} from "../src/index.ts";
import { mount, settle, silenceCaughtErrors } from "./fixtures/browser.tsx";
import { issue, serve, titled } from "./fixtures/issues.ts";
import { load } from "./fixtures/server.ts";

const textOf = (
	result: AsyncResult.AsyncResult<
		{ readonly title: string },
		{ readonly _tag: string }
	>,
) => {
	if (AsyncResult.isInitial(result)) {
		return "Loading";
	}
	if (AsyncResult.isSuccess(result)) {
		return result.value.title;
	}
	const error = AsyncResult.error(result);
	return `Failed: ${Option.isSome(error) ? error.value._tag : "defect"}${result.waiting ? " (refreshing)" : ""}`;
};

/** Renders every state of the read, and records each render's text. */
const titles = () => {
	const rendered = vi.fn<(text: string) => void>();
	function Title(props: { readonly issue: Handle<typeof issue> }) {
		const text = textOf(useHandleValue(issue, props.issue));
		rendered(text);
		return <p>{text}</p>;
	}
	return { rendered: () => rendered.mock.calls.map(([text]) => text), Title };
};

/** Counts the renders of a Suspense fallback: how often a read suspended. */
const suspensions = () => {
	const rendered = vi.fn();
	const Fallback = () => {
		rendered();
		return <p>Suspended</p>;
	};
	return { count: () => rendered.mock.calls.length, fallback: <Fallback /> };
};

const nodeOf = (app: ReturnType<typeof mount>, id: number) =>
	app.registry.getNodes().get(`AtomRpc:GetIssue:${id}`);

describe("useHandleValue", () => {
	it("returns Initial while a prefetched atom loads, without suspending", async () => {
		using server = serve();
		using app = mount();
		const shown = titles();
		const suspended = suspensions();
		const handle = Loader.make(app.registry).prefetch(issue, 1);
		await app.render(
			<React.Suspense fallback={suspended.fallback}>
				<shown.Title issue={handle} />
			</React.Suspense>,
		);
		expect(screen.getByText("Issue 1")).toBeDefined();
		expect(shown.rendered()[0]).toBe("Loading");
		expect(suspended.count()).toBe(0);
		expect(server.requests(1)).toBe(1);
	});

	it("returns a defect instead of throwing it", async () => {
		using _server = serve({ 1: ["crash"] });
		using app = mount();
		const { Title } = titles();
		const handle = Loader.make(app.registry).prefetch(issue, 1);
		await app.render(<Title issue={handle} />);
		expect(screen.getByText("Failed: defect")).toBeDefined();
	});

	it("keeps a failure while the atom refreshes, without suspending", async () => {
		using server = serve({ 1: ["missing", "found"] });
		using app = mount();
		const shown = titles();
		const suspended = suspensions();
		const handle = await Loader.make(app.registry).ensure(issue, 1);
		await app.render(
			<React.Suspense fallback={suspended.fallback}>
				<shown.Title issue={handle} />
			</React.Suspense>,
		);
		expect(screen.getByText("Failed: IssueNotFound")).toBeDefined();
		await act(async () => {
			app.registry.refresh(issue(1));
		});
		await settle();
		expect(screen.getByText("Issue 1")).toBeDefined();
		expect(shown.rendered()).toContain("Failed: IssueNotFound (refreshing)");
		expect(suspended.count()).toBe(0);
		expect(server.requests(1)).toBe(2);
	});

	it("ends the loader's lease once it subscribes", async () => {
		using server = serve();
		using app = mount();
		const { Title } = titles();
		const handle = Loader.make(app.registry).prefetch(issue, 1);
		await app.render(<Title issue={handle} />);
		expect(screen.getByText("Issue 1")).toBeDefined();
		await app.unmount();
		await settle(2000);
		expect(nodeOf(app, 1)).toBeUndefined();
		expect(server.requests(1)).toBe(1);
	});

	it("leaves the atom to its readers when a loader starts it again", async () => {
		using server = serve();
		using app = mount();
		const { Title } = titles();
		const loader = Loader.make(app.registry);
		const handle = loader.prefetch(issue, 1);
		await app.render(<Title issue={handle} />);
		expect(screen.getByText("Issue 1")).toBeDefined();
		loader.prefetch(issue, 1);
		await app.unmount();
		await settle(2000);
		expect(nodeOf(app, 1)).toBeUndefined();
		expect(server.requests(1)).toBe(1);
	});

	it("reads a derived source through the atom it points at, ending that lease", async () => {
		using server = serve();
		using app = mount();
		function DerivedTitle(props: { readonly issue: Handle<typeof titled> }) {
			return <p>{textOf(useHandleValue(titled, props.issue))}</p>;
		}
		const handle = Loader.make(app.registry).prefetch(titled, 3);
		await app.render(<DerivedTitle issue={handle} />);
		expect(screen.getByText("Titled Issue 3")).toBeDefined();
		await app.unmount();
		await settle(2000);
		expect(nodeOf(app, 3)).toBeUndefined();
		expect(server.requests(3)).toBe(1);
	});

	it("waits for a streamed result instead of requesting it", async () => {
		using server = serve();
		using rendered = await load(Loader.prefetch(issue, 2));
		using app = mount();
		const shown = titles();
		await app.render(
			<HydrationBoundary state={rendered.state}>
				<shown.Title issue={rendered.handles} />
			</HydrationBoundary>,
		);
		await settle(100);
		expect(screen.getByText("Issue 2")).toBeDefined();
		expect(shown.rendered()[0]).toBe("Loading");
		expect(server.requests(2)).toBe(1);
	});

	it("starts a handle the server left to the browser, without a waterfall report", async () => {
		using server = serve();
		using loaded = await load(Loader.prefetchInBrowser(issue, 1));
		using app = mount();
		const { Title } = titles();
		await app.render(
			<WaterfallDetection mode="throw">
				<Title issue={loaded.handles} />
			</WaterfallDetection>,
		);
		expect(screen.getByText("Issue 1")).toBeDefined();
		expect(server.requests(1)).toBe(1);
	});

	it("throws in development on a handle from another source", async () => {
		using _server = serve();
		using _errors = silenceCaughtErrors();
		using app = mount();
		const handle = Loader.make(app.registry).prefetch(issue, 1);
		const next = (id: number) => issue(id + 1);
		const Misread = () => {
			useHandleValue(next, handle);
			return null;
		};
		await app.render(<Misread />);
		expect(
			screen.getByText(
				/useHandleValue read the handle of AtomRpc:GetIssue:1 through a source that makes AtomRpc:GetIssue:2/,
			),
		).toBeDefined();
	});
});
