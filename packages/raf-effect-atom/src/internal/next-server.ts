import type * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type * as EffectHydration from "effect/reactivity/Hydration";
import * as React from "react";

import * as Hydration from "../hydration.ts";
import * as Loader from "../loader.ts";
import * as RequestRegistry from "../request-registry.ts";

// Server components evaluate this module, so it must not import
// `@effect/atom-react`, which needs React's client APIs.

export const getRegistry: () => AtomRegistry.AtomRegistry = React.cache(() => {
	const registry = RequestRegistry.make();
	// SAFETY: React's cacheSignal returns an AbortSignal during a server
	// component render, which @types/react declares as an empty interface.
	const signal = React.cacheSignal() as AbortSignal | null;
	signal?.addEventListener("abort", () => registry.dispose(), { once: true });
	return registry;
});

const getLoader = React.cache(() => Loader.make(getRegistry()));

export const prefetch = <A, E>(
	atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
): void => getLoader().prefetch(atom);

export const ensure = <A, E>(
	atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
): Promise<Loader.SettledResult<A, E>> => getLoader().ensure(atom);

export const fetch = <A, E>(
	atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
): Promise<Loader.SettledResult<A, E>> => getLoader().fetch(atom);

export const dehydrate = (): Array<EffectHydration.DehydratedAtom> =>
	Hydration.dehydrate(getRegistry());
