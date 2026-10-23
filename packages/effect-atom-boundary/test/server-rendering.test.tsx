import {
	HydrationBoundary,
	RegistryContext,
	scheduleTask,
	useAtomSuspense,
} from "@effect/atom-react";
import { describe, expect, it, vi } from "@effect/vitest";
import { act, screen, within } from "@testing-library/react";
import * as Cause from "effect/Cause";
import * as Option from "effect/Option";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as Hydration from "effect/reactivity/Hydration";
import * as React from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToReadableStream } from "react-dom/server";

import { AtomErrorBoundary, createErrorBoundary } from "../src/index.ts";
import { hydratedIssue, Issues, serve } from "./fixtures/issues.ts";

const [AuthBoundary, useAuthBoundary] = createErrorBoundary({
	catchTags: {
		Unauthorized: (caught) => (
			<button onClick={caught.reset} type="button">
				{`Signed out: ${caught.error.reason}`}
			</button>
		),
	},
	errors: Issues,
	name: "Auth",
});

const [IssueBoundary, useIssueBoundary] = createErrorBoundary({
	catchTags: {
		IssueNotFound: (caught) => (
			<button onClick={caught.reset} type="button">
				{`No issue ${caught.error.id}`}
			</button>
		),
	},
	errors: Issues,
	name: "Issue",
	parent: AuthBoundary,
});

/** Returns typed failures and throws defects, as `raf-effect-atom`'s read. */
const useRead = <A, E>(
	atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
): AsyncResult.Success<A, E> | AsyncResult.Failure<A, E> => {
	const result = useAtomSuspense(atom, {
		includeFailure: true,
		suspendOnWaiting: true,
	});
	if (
		AsyncResult.isFailure(result) &&
		Option.isNone(Cause.findErrorOption(result.cause))
	) {
		throw Cause.squash(result.cause);
	}
	return result;
};

function SharedTitle(props: { readonly id: number }) {
	useAuthBoundary(hydratedIssue);
	const result = useRead(useIssueBoundary(hydratedIssue(props.id)));
	return (
		<p>{AsyncResult.isSuccess(result) ? result.value.title : "Not caught"}</p>
	);
}

const SharedPage = (props: { readonly id: number }) => (
	<AuthBoundary>
		<p>Header</p>
		<IssueBoundary>
			<React.Suspense fallback={<p>Loading</p>}>
				<SharedTitle id={props.id} />
			</React.Suspense>
		</IssueBoundary>
	</AuthBoundary>
);

function OwnTitle(props: { readonly id: number }) {
	const result = useAtomSuspense(
		AtomErrorBoundary.claim(hydratedIssue(props.id)),
		{ suspendOnWaiting: true },
	);
	return <p>{result.value.title}</p>;
}

const OwnNotFound = (caught: {
	readonly error: { readonly id: number };
	readonly reset: () => void;
}) => (
	<button onClick={caught.reset} type="button">
		{`Own: no issue ${caught.error.id}`}
	</button>
);

const OwnPage = (props: { readonly id: number }) => (
	<AtomErrorBoundary
		atom={hydratedIssue(props.id)}
		catchTags={{ IssueNotFound: OwnNotFound }}
	>
		<React.Suspense fallback={<p>Loading</p>}>
			<OwnTitle id={props.id} />
		</React.Suspense>
	</AtomErrorBoundary>
);

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

const settle = async (ms = 30) => {
	await act(async () => {
		await new Promise((resolve) => {
			setTimeout(resolve, ms);
		});
	});
};

/** Runs `server` without a `window`, as a server does. */
const withoutWindow = async <A,>(server: () => Promise<A>): Promise<A> => {
	const window = Object.getOwnPropertyDescriptor(globalThis, "window");
	// oxlint-disable-next-line typescript/no-dynamic-delete -- a server has no window
	Reflect.deleteProperty(globalThis, "window");
	try {
		return await server();
	} finally {
		if (window !== undefined) {
			Object.defineProperty(globalThis, "window", window);
		}
	}
};

/** One request's registry, with the issue loaded as a loader would. */
const load = async (id: number) => {
	const registry = AtomRegistry.make();
	const release = registry.mount(hydratedIssue(id));
	while (AsyncResult.isInitial(registry.get(hydratedIssue(id)))) {
		await new Promise((resolve) => {
			setTimeout(resolve, 5);
		});
	}
	return {
		registry,
		[Symbol.dispose]: () => {
			release();
			registry.dispose();
		},
	};
};

/**
 * Starts rendering `page` in the request's registry with React's server
 * renderer, returning once the shell is out. `finish` waits for the rest of
 * the stream and dehydrates the registry.
 */
const stream = async (
	registry: AtomRegistry.AtomRegistry,
	page: React.ReactNode,
) => {
	const errors: Array<unknown> = [];
	const html = await renderToReadableStream(
		<RegistryContext.Provider value={registry}>
			{page}
		</RegistryContext.Provider>,
		{
			onError: (error) => {
				errors.push(error);
			},
		},
	);
	return {
		finish: async () => {
			await html.allReady;
			return {
				errors,
				html: await new Response(html).text(),
				state: Hydration.dehydrate(registry),
			};
		},
	};
};

/**
 * Loads the issue in a request registry, as a loader would, renders `page`
 * with React's server renderer, and dehydrates the registry.
 */
const renderOnServer = (id: number, page: React.ReactNode) =>
	withoutWindow(async () => {
		using request = await load(id);
		const rendering = await stream(request.registry, page);
		return await rendering.finish();
	});

/** Hydrates the server's HTML in the browser with a fresh registry. */
const hydrateInBrowser = async (
	server: Awaited<ReturnType<typeof renderOnServer>>,
	page: React.ReactNode,
) => {
	const container = document.createElement("div");
	container.innerHTML = server.html;
	document.body.append(container);
	const registry = AtomRegistry.make({ defaultIdleTTL: 400, scheduleTask });
	const recoverable: Array<unknown> = [];
	const root = await act(async () =>
		hydrateRoot(
			container,
			<RegistryContext.Provider value={registry}>
				<HydrationBoundary state={server.state}>{page}</HydrationBoundary>
			</RegistryContext.Provider>,
			{ onRecoverableError: (error) => recoverable.push(error) },
		),
	);
	await settle();
	return {
		recoverable,
		screen: within(container),
		[Symbol.dispose]: () => {
			act(() => {
				root.unmount();
			});
			container.remove();
			registry.dispose();
		},
	};
};

const click = async (text: string) => {
	await act(async () => {
		screen.getByText(text).click();
	});
	await settle();
};

const silenceCaughtErrors = () =>
	vi.spyOn(console, "error").mockImplementation(() => {});

describe("a boundary during server rendering", () => {
	it("renders a shared boundary's handler for a failure it catches", async () => {
		using _server = serve({ 1: ["missing", "found"] });
		using _errors = silenceCaughtErrors();
		const server = await renderOnServer(1, <SharedPage id={1} />);
		expect(server.errors).toEqual([]);
		expect(server.html).toContain("Header");
		expect(server.html).toContain("No issue 1");
		using browser = await hydrateInBrowser(server, <SharedPage id={1} />);
		expect(browser.recoverable).toEqual([]);
		await click("No issue 1");
		expect(screen.getByText("Issue 1")).toBeDefined();
	});

	it("leaves a tag it has no handler for to the boundary above", async () => {
		using _server = serve({ 2: ["signed-out", "found"] });
		using _errors = silenceCaughtErrors();
		const server = await renderOnServer(2, <SharedPage id={2} />);
		expect(server.errors).toEqual([]);
		expect(server.html).toContain("Signed out: expired");
		expect(server.html).not.toContain("Header");
		using browser = await hydrateInBrowser(server, <SharedPage id={2} />);
		expect(browser.recoverable).toEqual([]);
		await click("Signed out: expired");
		expect(screen.getByText("Issue 2")).toBeDefined();
	});

	it("renders an AtomErrorBoundary's handler for its atom's failure", async () => {
		using _server = serve({ 3: ["missing", "found"] });
		using _errors = silenceCaughtErrors();
		const server = await renderOnServer(3, <OwnPage id={3} />);
		expect(server.errors).toEqual([]);
		expect(server.html).toContain("Own: no issue 3");
		using browser = await hydrateInBrowser(server, <OwnPage id={3} />);
		expect(browser.recoverable).toEqual([]);
		await click("Own: no issue 3");
		expect(screen.getByText("Issue 3")).toBeDefined();
	});

	it("keeps two overlapping requests' failures and resets apart", async () => {
		// The first request's load fails, the second's and the reset find it.
		using server = serve({ 5: ["signed-out", "found"] });
		using _errors = silenceCaughtErrors();
		const Gate = makeGate(2);
		const [signedOut, signedIn] = await withoutWindow(async () => {
			using first = await load(5);
			using second = await load(5);
			const render = async (
				request: string,
				registry: AtomRegistry.AtomRegistry,
			) => {
				const rendering = await stream(
					registry,
					<Gate request={request}>
						<SharedPage id={5} />
					</Gate>,
				);
				return await rendering.finish();
			};
			return await Promise.all([
				render("first", first.registry),
				render("second", second.registry),
			]);
		});
		expect(signedOut.errors).toEqual([]);
		expect(signedOut.html).toContain("Signed out: expired");
		expect(signedOut.html).not.toContain("Issue 5");
		expect(signedIn.errors).toEqual([]);
		expect(signedIn.html).toContain("Issue 5");
		expect(signedIn.html).not.toContain("Signed out");

		using signedOutTab = await hydrateInBrowser(
			signedOut,
			<SharedPage id={5} />,
		);
		using signedInTab = await hydrateInBrowser(signedIn, <SharedPage id={5} />);
		expect(signedOutTab.recoverable).toEqual([]);
		expect(signedInTab.recoverable).toEqual([]);
		expect(server.requests(5)).toBe(2);

		await act(async () => {
			signedOutTab.screen.getByText("Signed out: expired").click();
		});
		await settle();
		expect(signedOutTab.screen.getByText("Issue 5")).toBeDefined();
		expect(signedInTab.screen.getByText("Issue 5")).toBeDefined();
		expect(server.requests(5)).toBe(3);
	});

	it("renders the children when nothing it catches failed", async () => {
		using _server = serve({ 4: ["found"] });
		const server = await renderOnServer(4, <SharedPage id={4} />);
		expect(server.html).toContain("Issue 4");
		expect(server.html).not.toContain("<template");
		using browser = await hydrateInBrowser(server, <SharedPage id={4} />);
		expect(browser.recoverable).toEqual([]);
		expect(screen.getByText("Issue 4")).toBeDefined();
	});
});
