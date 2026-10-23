import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as React from "react";

import type { ArgsOf, Handle, LoadedHandle, Source } from "../Handle.ts";
import * as Loader from "../Loader.ts";
import * as RequestRegistry from "../RequestRegistry.ts";

// Server components evaluate this module, so it must not import
// `@effect/atom-react`, which needs React's client APIs.

export interface RequestAtoms extends Loader.Loader {
	readonly getRegistry: () => AtomRegistry.AtomRegistry;
}

const renderSignal = (): AbortSignal | null => {
	// SAFETY: React's cacheSignal returns an AbortSignal during a server
	// component render, which @types/react declares as an empty interface.
	const signal = React.cacheSignal() as AbortSignal | null;
	return signal;
};

export const make = (options?: RequestRegistry.Options): RequestAtoms => {
	const getRegistry = React.cache(() => {
		const registry = RequestRegistry.make(options);
		renderSignal()?.addEventListener("abort", () => registry.dispose(), {
			once: true,
		});
		return registry;
	});
	const getLoader = React.cache(() =>
		Loader.make(getRegistry(), { signal: renderSignal() ?? undefined }),
	);
	return {
		ensure: <S extends Source>(
			source: S,
			...args: ArgsOf<S>
		): Promise<LoadedHandle<S>> => getLoader().ensure(source, ...args),
		fetch: <S extends Source>(
			source: S,
			...args: ArgsOf<S>
		): Promise<LoadedHandle<S>> => getLoader().fetch(source, ...args),
		getRegistry,
		prefetch: <S extends Source>(source: S, ...args: ArgsOf<S>): Handle<S> =>
			getLoader().prefetch(source, ...args),
		prefetchInBrowser: <S extends Source>(
			source: S,
			...args: ArgsOf<S>
		): Handle<S> => getLoader().prefetchInBrowser(source, ...args),
		run: (effect, runOptions) => getLoader().run(effect, runOptions),
	};
};
