import { RegistryContext, scheduleTask } from "@effect/atom-react";
import { vi } from "@effect/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as React from "react";
import { ErrorBoundary } from "react-error-boundary";

/**
 * A browser registry like `RegistryProvider`'s, with the app's own error
 * boundary around the tree.
 */
export const mount = () => {
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
		unmount: async () => {
			await act(async () => {
				cleanup();
			});
		},
	};
};

/** Lets RPC responses and React's retries land. */
export const settle = async (ms = 20) => {
	await act(async () => {
		await new Promise((resolve) => {
			setTimeout(resolve, ms);
		});
	});
};

export const click = async (text: string) => {
	await act(async () => {
		screen.getByText(text).click();
	});
	await settle();
};

export const silenceCaughtErrors = () =>
	vi.spyOn(console, "error").mockImplementation(() => {});
