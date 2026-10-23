/**
 * Request waterfalls: the escape hatch for atoms only a render can start,
 * and the development check that finds the others.
 *
 * @stability unstable
 * @since 0.1.0
 */
"use client";

import { RegistryContext } from "@effect/atom-react";
import * as Effect from "effect/Effect";
import * as Predicate from "effect/Predicate";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as React from "react";

import { hydrated } from "./Hydration.ts";
import * as Leases from "./internal/leases.ts";
import * as Pending from "./internal/pending.ts";
import * as Waterfalls from "./internal/waterfalls.ts";
import { prefetch } from "./Loader.ts";

// Bundlers replace `process.env.NODE_ENV` at build time. Declared here, so
// apps that type-check this source don't need Node's types.
declare const process: {
	readonly env: { readonly NODE_ENV?: string | undefined };
};

/**
 * What `useAtomResult` does in development when a read starts an atom that
 * no loader, server component, event handler or `useWaterfall` started.
 *
 * - `"warn"`: `console.warn` once per atom, naming it. The default.
 * - `"throw"`: throw to the nearest error boundary, so the page can't be
 *   used until the atom starts before render.
 * - `"off"`: don't check.
 *
 * @stability unstable
 * @category models
 * @since 0.1.0
 */
export type WaterfallMode = Waterfalls.Mode;

/**
 * Sets how `useAtomResult` reports request waterfalls in the tree below.
 *
 * **When to use**
 *
 * Put it in the root layout, around the app. `"throw"` turns every atom a
 * component starts on its own into an error in development, which a person
 * or a coding agent can't miss.
 *
 * **Details**
 *
 * Production builds don't check: the check sits behind
 * `process.env.NODE_ENV !== "production"`, which bundlers replace at build
 * time, so it's left out of the bundle, and this component renders only its
 * children.
 *
 * **Example**
 *
 * ```tsx
 * import { WaterfallDetection } from "raf-effect-atom"
 *
 * function App(props: { readonly children: React.ReactNode }) {
 *   return <WaterfallDetection mode="throw">{props.children}</WaterfallDetection>
 * }
 * ```
 *
 * @stability unstable
 * @category components
 * @since 0.1.0
 */
export const WaterfallDetection = (props: {
	readonly children?: React.ReactNode | undefined;
	readonly mode: WaterfallMode;
}): React.ReactNode =>
	process.env.NODE_ENV === "production" ? (
		props.children
	) : (
		<Waterfalls.ModeContext value={props.mode}>
			{props.children}
		</Waterfalls.ModeContext>
	);

/**
 * Starts an atom during render and returns it, for an input only a render
 * knows, such as an id from another atom's result.
 *
 * **When to use**
 *
 * Only when no loader or server component can start the atom: each call is
 * a request waterfall, a round trip after the render that found the input.
 * Prefer putting the input in the route, or a procedure that resolves it on
 * the server. Searching a codebase for `useWaterfall` lists its waterfalls.
 *
 * **Details**
 *
 * - Starts the atom like `Loader.prefetch`, with a lease that
 *   `useAtomResult` takes over when the component mounts, and only if
 *   nothing started it yet: re-renders start nothing.
 * - A result the server is still streaming is awaited by `useAtomResult`,
 *   not started again.
 * - `useAtomResult` doesn't report an atom started this way.
 *
 * **Gotchas**
 *
 * Pass it the atom a loader would start, inside an error boundary's `wrap`:
 * `useAtomResult(boundary.wrap(useWaterfall(user(id))))`. The wrapper isn't
 * serializable, so the server couldn't send it to the browser.
 *
 * **Example**
 *
 * ```tsx
 * import { useAtomResult, useWaterfall } from "raf-effect-atom"
 *
 * function Author(props: { readonly userId: UserId }) {
 *   const result = useAtomResult(useWaterfall(user(props.userId)))
 *   // ...
 * }
 * ```
 *
 * @see {@link WaterfallDetection} for the development check it opts out of
 *
 * @stability unstable
 * @category hooks
 * @since 0.1.0
 */
export const useWaterfall = <
	Self extends Atom.Atom<AsyncResult.AsyncResult<unknown, unknown>>,
>(
	atom: Self,
): Self => {
	const registry = React.useContext(RegistryContext);
	const target = hydrated(atom);
	const key = Leases.keyOf(target);
	const streamed =
		Predicate.isString(key) && Pending.get(registry, key) !== undefined;
	if (!streamed && !Waterfalls.isStarted(registry, target)) {
		Effect.runSync(
			Effect.provideService(
				prefetch(atom),
				AtomRegistry.AtomRegistry,
				registry,
			),
		);
	}
	return atom;
};
