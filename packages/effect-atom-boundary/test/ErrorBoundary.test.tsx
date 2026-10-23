import {
	RegistryContext,
	scheduleTask,
	useAtomSuspense,
} from "@effect/atom-react";
import { describe, expect, it, vi } from "@effect/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import * as Cause from "effect/Cause";
import * as Option from "effect/Option";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as React from "react";
import { ErrorBoundary } from "react-error-boundary";

import {
	AtomErrorBoundary,
	type CatchTagProps,
	type CatchTags,
	claim,
	createErrorBoundary,
} from "../src/index.ts";
import { CompiledNotFound, type IssueNotFound } from "./fixtures/Handlers.tsx";
import { issue, Issues, serve } from "./fixtures/Issues.ts";

const [OfflineBoundary, useOfflineBoundary] = createErrorBoundary({
	catchTags: { Offline: () => <p>Offline</p> },
	errors: Issues,
	name: "Offline",
});

const [AuthBoundary, useAuthBoundary] = createErrorBoundary({
	catchTags: {
		Unauthorized: (props) => (
			<button onClick={props.reset} type="button">
				{`Signed out: ${props.error.reason}`}
			</button>
		),
	},
	errors: Issues,
	name: "Auth",
	parent: OfflineBoundary,
});

/**
 * A read like `raf-effect-atom`'s `useAtomResult`: suspends, returns typed
 * failures and throws defects.
 */
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

function Title(props: { readonly id: number }) {
	const result = useAtomSuspense(AtomErrorBoundary.claim(issue(props.id)), {
		suspendOnWaiting: true,
	});
	return <p>{result.value.title}</p>;
}

function ClaimedTitle(props: { readonly id: number }) {
	const result = useRead(useAuthBoundary().wrap(issue(props.id)));
	if (AsyncResult.isSuccess(result)) {
		return <p>{result.value.title}</p>;
	}
	const error = AsyncResult.error(result);
	return (
		<p>{`Result: ${Option.isSome(error) ? error.value._tag : "defect"}`}</p>
	);
}

function NotFound(props: {
	readonly id: number;
	readonly onRetry: () => void;
}) {
	return (
		<button onClick={props.onRetry} type="button">
			{`No issue ${props.id}`}
		</button>
	);
}

const catchIssueTags = {
	IssueNotFound: (caught) => (
		<NotFound id={caught.error.id} onRetry={caught.reset} />
	),
	Offline: (caught) => (
		<button onClick={caught.reset} type="button">
			Reconnect
		</button>
	),
} satisfies CatchTags<Atom.Failure<ReturnType<typeof issue>>>;

function AtomBoundaryTree(props: {
	readonly boundaryId?: number;
	readonly id: number;
}) {
	return (
		<AtomErrorBoundary
			atom={issue(props.boundaryId ?? props.id)}
			catchTags={catchIssueTags}
		>
			<React.Suspense fallback={<p>Loading</p>}>
				<Title id={props.id} />
			</React.Suspense>
		</AtomErrorBoundary>
	);
}

function ChainTree(props: { readonly id: number }) {
	return (
		<OfflineBoundary>
			<AuthBoundary>
				<React.Suspense fallback={<p>Loading</p>}>
					<ClaimedTitle id={props.id} />
				</React.Suspense>
			</AuthBoundary>
		</OfflineBoundary>
	);
}

/** A registry like `RegistryProvider`'s, and the app's own error boundary. */
const mount = () => {
	const registry = AtomRegistry.make({ defaultIdleTTL: 400, scheduleTask });
	const app = (children: React.ReactNode, strict = false) => {
		const tree = (
			<RegistryContext.Provider value={registry}>
				<ErrorBoundary
					fallbackRender={(caught) => <p>{`Outer: ${String(caught.error)}`}</p>}
				>
					{children}
				</ErrorBoundary>
			</RegistryContext.Provider>
		);
		return strict ? <React.StrictMode>{tree}</React.StrictMode> : tree;
	};
	let rerender: ((ui: React.ReactNode) => void) | undefined;
	return {
		registry,
		render: async (children: React.ReactNode, strict?: boolean) => {
			await act(async () => {
				if (rerender) {
					rerender(app(children, strict));
				} else {
					rerender = render(app(children, strict)).rerender;
				}
			});
			await settle();
		},
		[Symbol.dispose]: () => {
			cleanup();
			registry.dispose();
		},
	};
};

/** Lets RPC responses and React's retries land. */
const settle = async (ms = 20) => {
	await act(async () => {
		await new Promise((resolve) => {
			setTimeout(resolve, ms);
		});
	});
};

const click = async (text: string) => {
	await act(async () => {
		screen.getByText(text).click();
	});
	await settle();
};

const silenceCaughtErrors = () =>
	vi.spyOn(console, "error").mockImplementation(() => {});

describe("AtomErrorBoundary", () => {
	it("renders the handler for the failure's tag", async () => {
		using _server = serve({ 1: ["missing"] });
		using _errors = silenceCaughtErrors();
		using app = mount();
		await app.render(<AtomBoundaryTree id={1} />);
		expect(screen.getByText("No issue 1")).toBeDefined();
	});

	it("throws a tag without a handler to the boundaries above", async () => {
		using _server = serve({ 1: ["signed-out"] });
		using _errors = silenceCaughtErrors();
		using app = mount();
		await app.render(<AtomBoundaryTree id={1} />);
		expect(screen.getByText(/^Outer: Unauthorized/)).toBeDefined();
	});

	it("throws a failure of another atom to the boundaries above", async () => {
		using _server = serve({ 1: ["missing"] });
		using _errors = silenceCaughtErrors();
		using app = mount();
		await app.render(<AtomBoundaryTree boundaryId={2} id={1} />);
		expect(screen.getByText(/^Outer: IssueNotFound/)).toBeDefined();
	});

	it("throws a defect to the app's error boundary", async () => {
		using _server = serve({ 1: ["crash"] });
		using _errors = silenceCaughtErrors();
		using app = mount();
		await app.render(<AtomBoundaryTree id={1} />);
		expect(screen.getByText(/^Outer: .*the server crashed/)).toBeDefined();
	});

	it("refreshes the atom on reset", async () => {
		using server = serve({ 1: ["missing", "found"] });
		using _errors = silenceCaughtErrors();
		using app = mount();
		await app.render(<AtomBoundaryTree id={1} />);
		await click("No issue 1");
		expect(screen.getByText("Issue 1")).toBeDefined();
		expect(server.requests(1)).toBe(2);
	});

	it("clears a caught failure when its atom changes", async () => {
		using _server = serve({ 1: ["missing"] });
		using _errors = silenceCaughtErrors();
		using app = mount();
		await app.render(<AtomBoundaryTree id={1} />);
		await app.render(<AtomBoundaryTree id={2} />);
		expect(screen.getByText("Issue 2")).toBeDefined();
	});
});

describe("createErrorBoundary", () => {
	it("returns a failure no boundary claims in the result", async () => {
		using _server = serve({ 1: ["missing"] });
		using app = mount();
		await app.render(<ChainTree id={1} />);
		expect(screen.getByText("Result: IssueNotFound")).toBeDefined();
	});

	it("throws a claimed failure to the boundary that claims it", async () => {
		using _server = serve({ 1: ["signed-out"] });
		using _errors = silenceCaughtErrors();
		using app = mount();
		await app.render(<ChainTree id={1} />);
		expect(screen.getByText("Signed out: expired")).toBeDefined();
	});

	it("throws to the parent what only the parent claims", async () => {
		using _server = serve({ 1: ["offline"] });
		using _errors = silenceCaughtErrors();
		using app = mount();
		await app.render(<ChainTree id={1} />);
		expect(screen.getByText("Offline")).toBeDefined();
	});

	it("throws a defect to the app's error boundary", async () => {
		using _server = serve({ 1: ["crash"] });
		using _errors = silenceCaughtErrors();
		using app = mount();
		await app.render(<ChainTree id={1} />);
		expect(screen.getByText(/^Outer: .*the server crashed/)).toBeDefined();
	});

	it("refreshes the atom that failed on reset", async () => {
		using server = serve({ 1: ["signed-out", "found"] });
		using _errors = silenceCaughtErrors();
		using app = mount();
		await app.render(<ChainTree id={1} />);
		await click("Signed out: expired");
		expect(screen.getByText("Issue 1")).toBeDefined();
		expect(server.requests(1)).toBe(2);
	});

	it("wraps an atom once, so every render reads the same atom", async () => {
		using _server = serve();
		using app = mount();
		function Same() {
			const claims = useAuthBoundary();
			const first = claims.wrap(issue(1));
			const same =
				claims.wrap(issue(1)) === first && claims.wrap(issue(2)) !== first;
			return <p>{same ? "Same" : "Different"}</p>;
		}
		await app.render(
			<OfflineBoundary>
				<AuthBoundary>
					<Same />
				</AuthBoundary>
			</OfflineBoundary>,
		);
		expect(screen.getByText("Same")).toBeDefined();
		const claimed = AtomErrorBoundary.claim(issue(1));
		expect(AtomErrorBoundary.claim(issue(1))).toBe(claimed);
	});

	it("points the wrapper at the atom it wraps, not past it", () => {
		const reactive = Issues.query(
			"GetIssue",
			{ id: 1 },
			{ reactivityKeys: ["issues"], serializationKey: "1" },
		);
		expect(reactive.initialValueTarget).toBeDefined();
		expect(AtomErrorBoundary.claim(reactive).initialValueTarget).toBe(reactive);
	});

	it("needs its boundary mounted above its hook", async () => {
		using _errors = silenceCaughtErrors();
		using app = mount();
		function Lonely() {
			useOfflineBoundary();
			return null;
		}
		await app.render(<Lonely />);
		expect(
			screen.getByText(/found no <OfflineBoundary> above it/),
		).toBeDefined();
	});

	it("needs its parent mounted above it", async () => {
		using _errors = silenceCaughtErrors();
		using app = mount();
		await app.render(<AuthBoundary />);
		expect(
			screen.getByText(/<AuthBoundary> needs <OfflineBoundary>, its parent/),
		).toBeDefined();
	});
});

function HookNotFound(props: CatchTagProps<IssueNotFound>) {
	const [clicks, setClicks] = React.useState(0);
	return (
		<button
			onClick={() => {
				setClicks(clicks + 1);
			}}
			type="button"
		>
			{`Hook: no issue ${props.error.id}, ${clicks} clicks`}
		</button>
	);
}

describe("a handler that's a component", () => {
	const handlers = [
		{ Handler: HookNotFound, kind: "calls a hook", text: "Hook: no issue 1" },
		{
			Handler: CompiledNotFound,
			kind: "React Compiler compiled",
			text: "Compiled: no issue 1",
		},
	];

	it.each(handlers)("renders in AtomErrorBoundary ($kind)", async (each) => {
		using _server = serve({ 1: ["missing"] });
		using _errors = silenceCaughtErrors();
		using app = mount();
		await app.render(
			<AtomErrorBoundary
				atom={issue(1)}
				catchTags={{ IssueNotFound: each.Handler }}
			>
				<React.Suspense fallback={<p>Loading</p>}>
					<Title id={1} />
				</React.Suspense>
			</AtomErrorBoundary>,
		);
		expect(screen.getByText(new RegExp(`^${each.text}`))).toBeDefined();
	});

	it.each(handlers)("renders in createErrorBoundary ($kind)", async (each) => {
		using _server = serve({ 1: ["missing"] });
		using _errors = silenceCaughtErrors();
		using app = mount();
		const [NotFoundBoundary, useNotFoundBoundary] = createErrorBoundary({
			catchTags: { IssueNotFound: each.Handler },
			errors: Issues,
			name: "NotFound",
		});
		function Read() {
			const result = useRead(useNotFoundBoundary().wrap(issue(1)));
			return <p>{AsyncResult.isSuccess(result) ? result.value.title : null}</p>;
		}
		await app.render(
			<NotFoundBoundary>
				<React.Suspense fallback={<p>Loading</p>}>
					<Read />
				</React.Suspense>
			</NotFoundBoundary>,
		);
		expect(screen.getByText(new RegExp(`^${each.text}`))).toBeDefined();
	});

	it("keeps a handler's state between renders", async () => {
		using _server = serve({ 1: ["missing"] });
		using _errors = silenceCaughtErrors();
		using app = mount();
		const tree = () => (
			<AtomErrorBoundary
				atom={issue(1)}
				catchTags={{ IssueNotFound: HookNotFound }}
			>
				<Title id={1} />
			</AtomErrorBoundary>
		);
		await app.render(tree());
		await click("Hook: no issue 1, 0 clicks");
		await app.render(tree());
		expect(screen.getByText("Hook: no issue 1, 1 clicks")).toBeDefined();
	});
});

describe("claim", () => {
	it("returns a success and throws a typed failure", async () => {
		using _server = serve({ 1: ["found"], 2: ["missing"] });
		using app = mount();
		const release = [
			app.registry.mount(issue(1)),
			app.registry.mount(issue(2)),
		];
		await settle();
		const found = app.registry.get(issue(1));
		const missing = app.registry.get(issue(2));
		if (AsyncResult.isInitial(found) || AsyncResult.isInitial(missing)) {
			throw new Error("expected both reads to settle");
		}
		expect(claim(issue(1), app.registry, found)).toBe(found);
		expect(() => claim(issue(2), app.registry, missing)).toThrow(
			expect.objectContaining({ _tag: "IssueNotFound", id: 2 }),
		);
		for (const dispose of release) {
			dispose();
		}
	});
});

describe("request count", () => {
	it.each([
		{ name: "AtomErrorBoundary", reset: "Reconnect", tree: AtomBoundaryTree },
		{
			name: "createErrorBoundary",
			reset: "Signed out: expired",
			tree: ChainTree,
		},
	])(
		"requests a failed first load once, and once more on reset ($name)",
		async (each) => {
			using server = serve({
				1: [
					each.name === "AtomErrorBoundary" ? "offline" : "signed-out",
					"found",
				],
			});
			using _errors = silenceCaughtErrors();
			using app = mount();
			const Tree = each.tree;
			await app.render(<Tree id={1} />, true);
			expect(screen.getByText(each.reset)).toBeDefined();
			expect(server.requests(1)).toBe(1);

			// Re-renders, and the read's idle TTL and Suspense subscription
			// running out while the fallback shows, don't request it again.
			await app.render(<Tree id={1} />, true);
			await app.render(<Tree id={1} />, true);
			await settle(1100);
			expect(screen.getByText(each.reset)).toBeDefined();
			expect(server.requests(1)).toBe(1);

			await click(each.reset);
			expect(screen.getByText("Issue 1")).toBeDefined();
			expect(server.requests(1)).toBe(2);

			await app.render(<Tree id={1} />, true);
			await settle(500);
			expect(server.requests(1)).toBe(2);
		},
	);
});
