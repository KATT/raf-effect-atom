/**
 * Error boundaries typed by an atom's error. A boundary catches failures by
 * `_tag`, with a handler per tag typed by the error with that tag, so UI code
 * never imports an error class. `AtomErrorBoundary` guards one atom;
 * `createErrorBoundary` makes a shared boundary whose hook narrows the reads
 * under it.
 *
 * @stability unstable
 * @since 0.1.0
 */
"use client";

import { RegistryContext } from "@effect/atom-react";
import * as Predicate from "effect/Predicate";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import type * as AtomRpc from "effect/reactivity/AtomRpc";
import * as React from "react";

import {
	claim,
	type ErrorBoundaryClaims,
	type TagsOf,
	TypeId,
	type Variance,
} from "./claim.ts";
import * as FailedReads from "./internal/failed-reads.ts";
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
	/** Refreshes the atom that failed and renders the children again. */
	readonly reset: () => void;
}

/**
 * One optional handler per `_tag` of `E` (or per tag in `Tags`), each typed by
 * the error with that tag.
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
 * The error type of what a boundary's `errors` names: an `AtomRpc` client
 * (the errors of every procedure), an atom, or an atom family.
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

interface CatcherProps {
	readonly catches: (error: unknown) => Handler | undefined;
	readonly children?: React.ReactNode | undefined;
	readonly refresh: (error: unknown) => void;
	readonly resetKey?: unknown;
}

interface CatcherState {
	readonly caught: { readonly error: unknown } | undefined;
	readonly resetKey: unknown;
}

class Catcher extends React.Component<CatcherProps, CatcherState> {
	override state: CatcherState = {
		caught: undefined,
		resetKey: this.props.resetKey,
	};

	static getDerivedStateFromError(error: unknown): Partial<CatcherState> {
		return { caught: { error } };
	}

	static getDerivedStateFromProps(
		props: CatcherProps,
		state: CatcherState,
	): Partial<CatcherState> | null {
		if (Object.is(props.resetKey, state.resetKey)) {
			return null;
		}
		return { caught: undefined, resetKey: props.resetKey };
	}

	override render(): React.ReactNode {
		const caught = this.state.caught;
		if (caught === undefined) {
			return this.props.children;
		}
		const error = caught.error;
		const handler = this.props.catches(error);
		if (handler === undefined) {
			throw error;
		}
		// SAFETY: `catches` found the handler by the error's `_tag`, and
		// `CatchTags` types each handler by the error with that tag.
		const claimed = error as never;
		return handler({
			error: claimed,
			reset: () => {
				this.props.refresh(error);
				this.setState({ caught: undefined });
			},
		});
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
 * The reads under it use `useAtomResult(atom)`, which throws the atom's typed
 * failures. A failure whose tag has a handler renders that handler; its
 * `reset` refreshes the atom and renders the children again. A new `atom`
 * clears a caught failure.
 *
 * **Gotchas**
 *
 * A failure without a handler, or one thrown by a read of another atom, goes
 * to the error boundaries above.
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
	const atom = props.atom;
	const handlers: Handlers = props.catchTags;
	return (
		<Catcher
			catches={(error) => {
				const read = FailedReads.get(error);
				if (read !== undefined && read.atom !== atom) {
					return undefined;
				}
				return handlerFor(handlers, error);
			}}
			refresh={(error) => {
				const read = FailedReads.get(error) ?? { atom, registry };
				read.registry.refresh(read.atom);
			}}
			resetKey={atom}
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
 * A boundary component and the hook that returns its claims, named freely by
 * destructuring.
 *
 * @stability unstable
 * @category models
 * @since 0.1.0
 */
export type ErrorBoundary<Tags extends string> = readonly [
	Boundary: ErrorBoundaryComponent<Tags>,
	useBoundary: () => ErrorBoundaryClaims<Tags>,
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
	 * What the handlers' errors come from, for the types: an `AtomRpc`
	 * client, an atom, or an atom family.
	 */
	readonly errors: Source;
	/** Names it in messages and React DevTools: `"Auth"` is `<AuthBoundary>`. */
	readonly name: string;
	/** The boundary it sits under, which must be mounted above it. */
	readonly parent?: ErrorBoundaryComponent<ParentTags> | undefined;
}

interface Internal {
	readonly claims: ErrorBoundaryClaims<string>;
	readonly displayName: string;
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

const refreshFailedRead = (error: unknown): void => {
	const read = FailedReads.get(error);
	read?.registry.refresh(read.atom);
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
 * A component that reads an atom with `useAtomResult(atom, useBoundary())`
 * throws the errors this boundary or one above it claims, to the nearest one
 * that claims them, and gets an `AsyncResult` typed without them. `parent` is
 * the boundary it sits under; the claimed tags add up along the chain.
 * `catchTags`' keys are tags of `errors`' error type, so a misspelled tag is a
 * type error and each handler's `error` is typed.
 *
 * **Gotchas**
 *
 * A boundary matches `_tag` only: a failure with a claimed tag from any atom
 * under it is caught. The boundary throws without its `parent` mounted above
 * it, and the hook throws outside its boundary.
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
 * function IssueTitle(props: { readonly id: number }) {
 *   const result = useAtomResult(issue(props.id), useAuthBoundary())
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
	const claims: ErrorBoundaryClaims<string> = {
		claim: (atom, registry, result) => claim(atom, registry, result, claims),
		owns: (error) =>
			handlerFor(handlers, error) !== undefined ||
			(parent?.claims.owns(error) ?? false),
		[TypeId]: variance,
	};
	const boundary: Internal = {
		claims,
		displayName: `${options.name}Boundary`,
	};

	const Boundary = (props: {
		readonly children?: React.ReactNode | undefined;
	}) => {
		const above = React.useContext(MountedBoundaries);
		if (parent && !isMounted(above, parent)) {
			throw new Error(
				`<${boundary.displayName}> needs <${parent.displayName}>, its parent, above it`,
			);
		}
		return (
			<Catcher
				catches={(error) => handlerFor(handlers, error)}
				refresh={refreshFailedRead}
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

	const useBoundary = (): ErrorBoundaryClaims<string> => {
		if (!isMounted(React.useContext(MountedBoundaries), boundary)) {
			throw new Error(
				`The ${options.name} error boundary's hook found no <${boundary.displayName}> above it: wrap the tree in <${boundary.displayName}>`,
			);
		}
		return claims;
	};

	// SAFETY: the tags are type-level only; `variance` is the same value for
	// every set of tags.
	return [component, useBoundary] as unknown as ErrorBoundary<
		Tags | ParentTags
	>;
};
