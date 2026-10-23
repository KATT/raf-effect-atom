/**
 * Handles: what a loader or server component hands to the component that
 * reads an atom. The loader verbs and `useWaterfall` return them, and
 * `useAtomResult` reads one through the atom family that made it, so a
 * component can't start a request from an id it was given.
 *
 * A handle is plain data, `{ args, key }`, so loader data and server
 * component props carry it as is.
 *
 * @stability unstable
 * @since 0.1.0
 */
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";

/**
 * What the verbs start and `useAtomResult` reads: an atom family, a function
 * from arguments to an `AsyncResult` atom such as an `AtomRpc` query, or an
 * `AsyncResult` atom that takes no arguments.
 *
 * @stability unstable
 * @category models
 * @since 0.1.0
 */
export type Source =
	// oxlint-disable-next-line typescript/no-explicit-any -- any atom's result
	| Atom.Atom<AsyncResult.AsyncResult<any, any>>
	// oxlint-disable-next-line typescript/no-explicit-any -- any family
	| ((...args: any) => Atom.Atom<AsyncResult.AsyncResult<any, any>>);

/**
 * The arguments a source takes: a family's parameters, or none for an atom.
 *
 * @stability unstable
 * @category utility types
 * @since 0.1.0
 */
export type ArgsOf<S> = S extends (...args: infer Args) => unknown ? Args : [];

/**
 * The success type of a source's `AsyncResult`.
 *
 * @stability unstable
 * @category utility types
 * @since 0.1.0
 */
export type SuccessOf<S> =
	ResultOf<S> extends AsyncResult.AsyncResult<infer A, infer _E> ? A : never;

/**
 * The error type of a source's `AsyncResult`.
 *
 * @stability unstable
 * @category utility types
 * @since 0.1.0
 */
export type ErrorOf<S> =
	ResultOf<S> extends AsyncResult.AsyncResult<infer _A, infer E> ? E : never;

type ResultOf<S> = S extends (...args: ReadonlyArray<never>) => infer Built
	? Built extends Atom.Atom<infer Result>
		? Result
		: never
	: S extends Atom.Atom<infer Result>
		? Result
		: never;

declare const SourceType: unique symbol;

/**
 * A handle's serialization key, branded with its source. The brand sits on
 * a string, so types that map loader data to what survives serialization,
 * such as React Router's, keep it as is.
 *
 * @stability unstable
 * @category models
 * @since 0.1.0
 */
export type HandleKey<S> = string & {
	/** Type-only: ties the handle to its source. Never present at runtime. */
	readonly [SourceType]?: S;
};

/**
 * An atom a loader started: its source's arguments, and the atom's
 * serialization key. Its type names its source, so `useAtomResult` reads it
 * only through a source with the same arguments and success type.
 *
 * **Details**
 *
 * `Loader.prefetch` and `useWaterfall` return it, without waiting: the
 * component that reads it suspends until the result settles.
 *
 * @see {@link LoadedHandle} for the handle `ensure` and `fetch` return
 *
 * @stability unstable
 * @category models
 * @since 0.1.0
 */
export interface Handle<S> {
	readonly args: ArgsOf<S>;
	/** The atom's serialization key; `undefined` for an atom without one. */
	readonly key: HandleKey<S> | undefined;
}

/**
 * A handle from `Loader.ensure` or `Loader.fetch`: they waited for the
 * result, so the component that reads it renders without suspending.
 *
 * **Details**
 *
 * A `LoadedHandle` fits a `Handle` prop, and a `Handle` doesn't fit a
 * `LoadedHandle` prop. In the loader that ran the verb, `Loader.result`
 * returns the result it waited for.
 *
 * @stability unstable
 * @category models
 * @since 0.1.0
 */
export interface LoadedHandle<S> extends Handle<S> {
	readonly loaded: true;
}
