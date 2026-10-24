/**
 * Error boundaries typed by an atom's error. A boundary catches failures by
 * `_tag`, with a handler per tag typed by the error with that tag, so UI code
 * never imports an error class. `AtomErrorBoundary` guards one atom;
 * `createErrorBoundary` makes a shared boundary whose hook narrows the atoms
 * read under it.
 *
 * @stability unstable
 * @since 0.1.0
 */
"use client";

import { RegistryContext } from "@effect/atom-react";
import * as Cause from "effect/Cause";
import type {
	HttpApiEndpoint,
	HttpApiGroup,
	HttpApiMiddleware,
} from "effect/http-api";
import * as Option from "effect/Option";
import * as Predicate from "effect/Predicate";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import type * as AtomHttpApi from "effect/reactivity/AtomHttpApi";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type * as AtomRpc from "effect/reactivity/AtomRpc";
import type * as Schema from "effect/Schema";
import * as React from "react";

import {
	type TagsOf,
	TypeId,
	type UseErrorBoundary,
	type Variance,
} from "./claim.ts";
import * as Prerender from "./internal/prerender.tsx";
import * as Refresh from "./internal/refresh.ts";
import { variance } from "./internal/variance.ts";

/**
 * Props for a `catchTags` handler: the caught error, and `reset`.
 *
 * @stability unstable
 * @category models
 * @since 0.1.0
 */
export interface CatchTagProps<E> {
	readonly error: E;
	/**
	 * Refreshes what failed and renders the children again: an
	 * `AtomErrorBoundary`'s atom, or every atom in the registry whose failure a
	 * `createErrorBoundary` boundary has a handler for.
	 */
	readonly reset: () => void;
}

/**
 * One optional handler per `_tag` of `E` (or per tag in `Tags`), each typed by
 * the error with that tag. A handler renders as a component, so it can call
 * hooks.
 *
 * @stability unstable
 * @category models
 * @since 0.1.0
 */
export type CatchTags<E, Tags extends TagsOf<E> = TagsOf<E>> = {
	readonly [Tag in Tags]?: (
		props: CatchTagProps<Extract<E, { readonly _tag: Tag }>>,
	) => React.ReactNode;
};

/**
 * The errors an `AtomHttpApi` query of each endpoint fails with: the
 * endpoint's errors and its middleware's.
 */
type EndpointErrors<Endpoint> =
	Endpoint extends HttpApiEndpoint.HttpApiEndpoint<
		infer _Identifier,
		infer _Method,
		infer _Path,
		infer _Params,
		infer _Query,
		infer _Payload,
		infer _Headers,
		infer _Success,
		infer Error extends Schema.Top,
		infer Middleware,
		infer _MiddlewareServices
	>
		?
				| Error["Type"]
				| HttpApiMiddleware.Error<Middleware>
				| HttpApiMiddleware.ClientError<Middleware>
		: never;

/**
 * The error type of what a boundary's `errors` names: an `AtomRpc` client
 * (the errors of every procedure), an `AtomHttpApi` client (the errors of
 * every endpoint and its middleware), an atom, or an atom family.
 *
 * @stability unstable
 * @category utility types
 * @since 0.1.0
 */
export type ErrorsOf<Source> =
	Source extends AtomRpc.AtomRpcClient<infer _Self, infer _Id, infer _Rpcs>
		? Source["query"] extends (...args: ReadonlyArray<never>) => infer Query
			? Query extends Atom.Atom<AsyncResult.AsyncResult<infer _A, infer E>>
				? E
				: never
			: never
		: Source extends AtomHttpApi.AtomHttpApiClient<
					infer _Self,
					infer _Id,
					infer Groups
			  >
			? EndpointErrors<HttpApiGroup.Endpoints<Groups>>
			: Source extends Atom.Atom<AsyncResult.AsyncResult<infer _A, infer E>>
				? E
				: Source extends (
							...args: ReadonlyArray<never>
					  ) => Atom.Atom<AsyncResult.AsyncResult<infer _A, infer E>>
					? E
					: never;

type Handler = (props: CatchTagProps<never>) => React.ReactNode;

type Handlers = Readonly<Record<string, Handler | undefined>>;

const handlerFor = (
	handlers: Handlers,
	error: unknown,
): Handler | undefined => {
	for (const [tag, handler] of Object.entries(handlers)) {
		if (handler !== undefined && Predicate.isTagged(error, tag)) {
			return handler;
		}
	}
	return undefined;
};

const caughtBy = (
	handlers: Handlers,
	error: Option.Option<unknown>,
): Prerender.Caught | undefined => {
	if (Option.isNone(error)) {
		return undefined;
	}
	const Handler = handlerFor(handlers, error.value);
	return Handler === undefined ? undefined : { error: error.value, Handler };
};

/**
 * Whether `error` is the typed error `atom` currently fails with in
 * `registry`: the same object, since a read throws the error its atom's
 * failure holds.
 */
const failsWith = (
	registry: AtomRegistry.AtomRegistry,
	// oxlint-disable-next-line typescript/no-explicit-any -- any atom's result
	atom: Atom.Atom<any>,
	error: unknown,
): boolean =>
	Option.exists(
		Prerender.peek(registry, atom),
		(value) =>
			AsyncResult.isAsyncResult(value) &&
			AsyncResult.isFailure(value) &&
			Option.exists(
				Cause.findErrorOption(value.cause),
				(failure) => failure === error,
			),
	);

interface CatcherProps {
	readonly children?: React.ReactNode | undefined;
	/** Finds the failure it catches during server rendering. */
	readonly find: Prerender.Find;
	readonly handlers: Handlers;
	/**
	 * `AtomErrorBoundary`'s atom: an error that isn't its current failure, such
	 * as one another atom's read threw, goes to the boundaries above, and a new
	 * atom clears a caught failure.
	 */
	// oxlint-disable-next-line typescript/no-explicit-any -- any atom's result
	readonly own?: Atom.Atom<any> | undefined;
	readonly registry: AtomRegistry.AtomRegistry;
	/** Refreshes what failed in `registry`, the boundary's. */
	readonly reset: (registry: AtomRegistry.AtomRegistry) => void;
}

interface CatcherState {
	readonly caught: { readonly error: unknown } | undefined;
	readonly resetKey: unknown;
}

class Catcher extends React.Component<CatcherProps, CatcherState> {
	override state: CatcherState = {
		caught: undefined,
		resetKey: this.props.own,
	};

	static getDerivedStateFromError(error: unknown): Partial<CatcherState> {
		return { caught: { error } };
	}

	static getDerivedStateFromProps(
		props: CatcherProps,
		state: CatcherState,
	): Partial<CatcherState> | null {
		const resetKey = props.own;
		if (Object.is(resetKey, state.resetKey)) {
			return null;
		}
		return { caught: undefined, resetKey };
	}

	override render(): React.ReactNode {
		const caught = this.state.caught;
		if (caught === undefined) {
			return (
				<Prerender.Prerendered find={this.props.find}>
					{this.props.children}
				</Prerender.Prerendered>
			);
		}
		const error = caught.error;
		const own = this.props.own;
		const registry = this.props.registry;
		const Handler =
			own !== undefined && !failsWith(registry, own, error)
				? undefined
				: handlerFor(this.props.handlers, error);
		if (Handler === undefined) {
			throw error;
		}
		// SAFETY: `catches` found the handler by the error's `_tag`, and
		// `CatchTags` types each handler by the error with that tag.
		const claimed = error as never;
		// A handler is a component: calling it here would run its hooks, and
		// React Compiler's memo cache, in this class component's render.
		return (
			<Handler
				error={claimed}
				reset={() => {
					this.props.reset(registry);
					this.setState({ caught: undefined });
				}}
			/>
		);
	}
}

/**
 * Props for an error boundary that catches one atom's failures by `_tag`.
 *
 * @stability unstable
 * @category components
 * @since 0.1.0
 */
export interface AtomErrorBoundaryProps<A, E> {
	/** The atom whose failures this boundary catches. */
	readonly atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>;
	/** A handler per `_tag` of the atom's error. */
	readonly catchTags: NoInfer<CatchTags<E>>;
	readonly children?: React.ReactNode | undefined;
}

/**
 * Provides an error boundary for one atom that renders a handler per `_tag`
 * of the atom's error, typed by the error with that tag.
 *
 * **When to use**
 *
 * Use when a subtree reads one atom and some of its failures should render
 * in place of the subtree, without the reading component handling them.
 *
 * **Details**
 *
 * The reads under it throw the atom's failures, as `useAtomSuspense` does
 * without `includeFailure`. A failure whose tag has a handler renders that
 * handler; its `reset` refreshes the atom and renders the children again. A
 * new `atom` clears a caught failure.
 *
 * React runs no error boundaries on the server, so during server rendering
 * it reads `atom` before its children, from the registry or its hydrated
 * state, and renders the handler for a failure that has settled. The
 * browser keeps that HTML while it hydrates, then renders the children,
 * which throw the failure to it again.
 *
 * **Gotchas**
 *
 * A failure without a handler, or an error that isn't the one the atom fails
 * with in the boundary's registry, such as one a read of another atom threw,
 * goes to the error boundaries above. Read with `suspendOnWaiting: true`, so
 * a read waits for the refresh `reset` starts instead of throwing the old
 * failure again. `reset` refreshes the atom in the registry
 * the boundary renders in, not in a `RegistryContext` provided under it. A
 * handler renders as a component: one written inline mounts again, losing its
 * state, each time the parent renders.
 *
 * **Example** (Catching a missing issue)
 *
 * ```tsx
 * <AtomErrorBoundary
 *   atom={issue(id)}
 *   catchTags={{
 *     IssueNotFound: ({ error, reset }) => <NotFound id={error.id} onRetry={reset} />
 *   }}
 * >
 *   <IssuePage id={id} />
 * </AtomErrorBoundary>
 *
 * function IssuePage(props: { readonly id: number }) {
 *   const result = useAtomSuspense(issue(props.id), { suspendOnWaiting: true })
 *   return <h1>{result.value.title}</h1>
 * }
 * ```
 *
 * @see {@link createErrorBoundary} for a shared boundary that narrows the reads under it
 *
 * @stability unstable
 * @category components
 * @since 0.1.0
 */
export const AtomErrorBoundary = <A, E>(
	props: AtomErrorBoundaryProps<A, E>,
): React.ReactNode => {
	const registry = React.useContext(RegistryContext);
	const handlers: Handlers = props.catchTags;
	const atom = props.atom;
	return (
		<Catcher
			find={(current) =>
				caughtBy(
					handlers,
					Option.flatMap(Prerender.peek(current, atom), Prerender.settledError),
				)
			}
			handlers={handlers}
			own={atom}
			registry={registry}
			reset={(current) => {
				Refresh.node(current, atom);
			}}
		>
			{props.children}
		</Catcher>
	);
};

/**
 * A boundary component: renders the `catchTags` handler for the errors it
 * claims and throws the rest to the boundaries above it.
 *
 * @stability unstable
 * @category components
 * @since 0.1.0
 */
export interface ErrorBoundaryComponent<
	Tags extends string,
> extends Variance<Tags> {
	(props: { readonly children?: React.ReactNode | undefined }): React.ReactNode;
	readonly displayName: string;
}

/**
 * A boundary component and its hook, which narrows the results read under
 * it, named freely by destructuring.
 *
 * @stability unstable
 * @category models
 * @since 0.1.0
 */
export type ErrorBoundary<Tags extends string> = readonly [
	Boundary: ErrorBoundaryComponent<Tags>,
	useBoundary: UseErrorBoundary<Tags>,
];

/**
 * Options for `createErrorBoundary`.
 *
 * @stability unstable
 * @category models
 * @since 0.1.0
 */
export interface ErrorBoundaryOptions<
	Source,
	Tags extends TagsOf<ErrorsOf<Source>>,
	ParentTags extends string,
> {
	/** A handler per `_tag` this boundary claims. */
	readonly catchTags: CatchTags<ErrorsOf<Source>, Tags>;
	/**
	 * What the handlers' errors come from, for the types: an `AtomRpc` or
	 * `AtomHttpApi` client, an atom, or an atom family.
	 */
	readonly errors: Source;
	/** Names it in messages and React DevTools: `"Auth"` is `<AuthBoundary>`. */
	readonly name: string;
	/** The boundary it sits under, which must be mounted above it. */
	readonly parent?: ErrorBoundaryComponent<ParentTags> | undefined;
}

interface Internal {
	readonly displayName: string;
	/** Returns whether this boundary or one above it claims `error`. */
	readonly owns: (error: unknown) => boolean;
}

interface Mounted {
	readonly boundary: Internal;
	readonly parent: Mounted | undefined;
}

const MountedBoundaries = React.createContext<Mounted | undefined>(undefined);

const internals = new WeakMap<object, Internal>();

const isMounted = (at: Mounted | undefined, boundary: Internal): boolean => {
	for (let mounted = at; mounted; mounted = mounted.parent) {
		if (mounted.boundary === boundary) {
			return true;
		}
	}
	return false;
};

/**
 * Creates a shared error boundary that claims some errors by `_tag`, returned
 * as `[Boundary, useBoundary]`.
 *
 * **When to use**
 *
 * Use for failures that belong to the app rather than to the component that
 * read them, such as being signed out, so the components under the boundary
 * only handle what's left.
 *
 * **Details**
 *
 * A component under it wraps its read in the hook:
 * `useBoundary(useAtomResult(issue, handle))` throws the failures this
 * boundary or one above it claims to the nearest boundary that claims them,
 * and returns the result typed without them. `parent` is the boundary it
 * sits under; the claimed tags add up along the chain. `catchTags`' keys are tags
 * of `errors`' error type, so a misspelled tag is a type error and each
 * handler's `error` is typed.
 *
 * A handler's `reset` refreshes every atom in the registry the boundary
 * renders in whose settled failure has a tag this boundary handles, not only
 * the one whose read threw:
 * one outage fails every atom on the page, and an atom that fails after the
 * handler replaced the children throws to no boundary.
 *
 * React runs no error boundaries on the server, so during server rendering
 * it looks through the registry's atoms before rendering its children, and
 * renders its handler for a settled failure it catches. It only sees atoms
 * that already ran in that registry, such as the loaders' on TanStack
 * Start, or under `raf-effect-atom`'s `HydrationBoundary` on React Router.
 * A failure it doesn't see is thrown on the server and caught in the
 * browser.
 *
 * **Gotchas**
 *
 * A boundary matches `_tag` only: a failure with a claimed tag from any atom
 * under it is caught. During server rendering, that's any atom in the
 * registry, read under it or not. The boundary throws without its `parent`
 * mounted above it, and the hook throws outside its boundary. The hook needs
 * a read that returns its failures, such as `raf-effect-atom`'s
 * `useAtomResult`: `useAtomSuspense` without `includeFailure` throws every
 * failure before the hook sees it.
 *
 * **Example** (A sign-in boundary)
 *
 * ```tsx
 * const [AuthBoundary, useAuthBoundary] = createErrorBoundary({
 *   name: "Auth",
 *   errors: Issues,
 *   catchTags: { Unauthorized: ({ reset }) => <SignIn onSignedIn={reset} /> }
 * })
 *
 * function IssueTitle(props: { readonly issue: Handle<typeof issue> }) {
 *   const result = useAuthBoundary(useAtomResult(issue, props.issue))
 *   // AsyncResult<Issue, IssueNotFound | RpcClientError>
 * }
 * ```
 *
 * @see {@link AtomErrorBoundary} for a boundary that guards one atom
 *
 * @stability unstable
 * @category constructors
 * @since 0.1.0
 */
export const createErrorBoundary = <
	Source,
	Tags extends TagsOf<ErrorsOf<Source>>,
	ParentTags extends string = never,
>(
	options: ErrorBoundaryOptions<Source, Tags, ParentTags>,
): ErrorBoundary<Tags | ParentTags> => {
	const parent = options.parent ? internals.get(options.parent) : undefined;
	const handlers: Handlers = options.catchTags;
	const owns = (error: unknown): boolean =>
		handlerFor(handlers, error) !== undefined || (parent?.owns(error) ?? false);
	const boundary: Internal = {
		displayName: `${options.name}Boundary`,
		owns,
	};
	const catches = (
		value: Option.Option<unknown>,
	): Prerender.Caught | undefined =>
		caughtBy(handlers, Option.flatMap(value, Prerender.settledError));
	const find: Prerender.Find = (registry) => {
		for (const node of registry.getNodes().values()) {
			const caught = catches(node.valueOption());
			if (caught !== undefined) {
				return caught;
			}
		}
		return undefined;
	};
	// One outage fails every atom on the page, and an atom whose failure
	// settles after the handler replaced the children throws to no boundary.
	// A refresh marks its dependents waiting, so each query refreshes once.
	const reset = (registry: AtomRegistry.AtomRegistry): void => {
		for (const node of Array.from(registry.getNodes().values())) {
			if (catches(node.valueOption()) !== undefined) {
				registry.refresh(node.atom);
			}
		}
	};

	// React Compiler compiles `Boundary` as if `options`, `handlers`, `find`
	// and `boundary` were module-level values, and moves a closure over them out
	// of this function, so `Boundary` creates no closures.
	const Boundary = (props: {
		readonly children?: React.ReactNode | undefined;
	}) => {
		const above = React.useContext(MountedBoundaries);
		const registry = React.useContext(RegistryContext);
		if (parent && !isMounted(above, parent)) {
			throw new Error(
				`<${boundary.displayName}> needs <${parent.displayName}>, its parent, above it`,
			);
		}
		return (
			<Catcher
				find={find}
				handlers={handlers}
				registry={registry}
				reset={reset}
			>
				<MountedBoundaries value={{ boundary, parent: above }}>
					{props.children}
				</MountedBoundaries>
			</Catcher>
		);
	};
	const component: ErrorBoundaryComponent<string> = Object.assign(Boundary, {
		displayName: boundary.displayName,
		[TypeId]: variance,
	});
	internals.set(component, boundary);

	// SAFETY: a claimed failure and a defect are thrown, so what's returned
	// is the result without them, as `UnclaimedResult` types it.
	const useBoundary = ((result: AsyncResult.AsyncResult<unknown, unknown>) => {
		if (!isMounted(React.useContext(MountedBoundaries), boundary)) {
			throw new Error(
				`The ${options.name} error boundary's hook found no <${boundary.displayName}> above it: wrap the tree in <${boundary.displayName}>`,
			);
		}
		if (AsyncResult.isFailure(result)) {
			const error = Cause.findErrorOption(result.cause);
			if (Option.isNone(error)) {
				throw Cause.squash(result.cause);
			}
			if (owns(error.value)) {
				throw error.value;
			}
		}
		return result;
	}) as UseErrorBoundary<string>;

	// SAFETY: the tags are type-level only; `variance` is the same value for
	// every set of tags.
	return [component, useBoundary] as unknown as ErrorBoundary<
		Tags | ParentTags
	>;
};
