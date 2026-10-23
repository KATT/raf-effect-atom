import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type * as EffectHydration from "effect/reactivity/Hydration";
import * as React from "react";

import type { ArgsOf, Handle, LoadedHandle, Source } from "../Handle.ts";
import * as Hydration from "../Hydration.ts";
import * as Loader from "../Loader.ts";
import * as RequestRegistry from "../RequestRegistry.ts";

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

export const prefetch = <S extends Source>(
	source: S,
	...args: ArgsOf<S>
): Handle<S> => getLoader().prefetch(source, ...args);

export const ensure = <S extends Source>(
	source: S,
	...args: ArgsOf<S>
): Promise<LoadedHandle<S>> => getLoader().ensure(source, ...args);

export const fetch = <S extends Source>(
	source: S,
	...args: ArgsOf<S>
): Promise<LoadedHandle<S>> => getLoader().fetch(source, ...args);

export const dehydrate = (): Array<EffectHydration.DehydratedAtom> =>
	Hydration.dehydrate(getRegistry());
