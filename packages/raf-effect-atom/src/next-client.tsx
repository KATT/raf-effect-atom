/**
 * The client components of `raf-effect-atom/next`.
 *
 * @stability unstable
 * @since 0.1.0
 */
"use client";

import { RegistryContext } from "@effect/atom-react";
import * as React from "react";

import * as Registry from "./internal/registry.ts";
import {
	HydrationBoundary,
	type HydrationBoundaryProps,
} from "./react-hydration.tsx";

/**
 * Provides the client components' registry: a request registry while Next.js
 * renders them on the server, and one registry for the page's lifetime in
 * the browser.
 *
 * **When to use**
 *
 * Put it in the root layout, around `children`, in place of
 * `@effect/atom-react`'s `RegistryProvider`, which would share one registry
 * between requests' server renders.
 *
 * **Example**
 *
 * ```tsx
 * import { RegistryProvider } from "raf-effect-atom/next"
 *
 * export default function RootLayout(props: { children: React.ReactNode }) {
 *   return <RegistryProvider>{props.children}</RegistryProvider>
 * }
 * ```
 *
 * @stability unstable
 * @category components
 * @since 0.1.0
 */
export const RegistryProvider = (props: {
	readonly children?: React.ReactNode | undefined;
}): React.ReactNode => {
	const [registry] = React.useState(Registry.make);
	return (
		<RegistryContext.Provider value={registry}>
			{props.children}
		</RegistryContext.Provider>
	);
};

/**
 * Hydrates the state a server component dehydrated with `dehydrate()`,
 * streamed results included.
 *
 * **Details**
 *
 * React serializes the state's promises with the server component's
 * payload, so a result still loading streams in when it settles, and
 * `useAtomResult` waits for it instead of requesting it again.
 *
 * **Example**
 *
 * ```tsx
 * import { dehydrate, ensure, HydrateAtoms } from "raf-effect-atom/next"
 *
 * export default async function IssuePage(props: { params: Promise<{ id: string }> }) {
 *   const id = Number((await props.params).id)
 *   await ensure(issue(id))
 *   return (
 *     <HydrateAtoms state={dehydrate()}>
 *       <Issue id={id} />
 *     </HydrateAtoms>
 *   )
 * }
 * ```
 *
 * @stability unstable
 * @category components
 * @since 0.1.0
 */
export const HydrateAtoms = (
	props: HydrationBoundaryProps,
): React.ReactNode => (
	<HydrationBoundary state={props.state}>{props.children}</HydrationBoundary>
);
