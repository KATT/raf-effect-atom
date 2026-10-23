import { RegistryContext } from "@effect/atom-react";
import * as Cause from "effect/Cause";
import * as Option from "effect/Option";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type * as Schema from "effect/Schema";
import * as React from "react";

/** @internal */
export interface Caught {
	readonly error: unknown;
	readonly Handler: (props: {
		readonly error: never;
		readonly reset: () => void;
	}) => React.ReactNode;
}

/**
 * Finds the handler for a settled failure the boundary catches, reading the
 * registry without starting any atom.
 *
 * @internal
 */
export type Find = (registry: AtomRegistry.AtomRegistry) => Caught | undefined;

/**
 * The typed error of a settled failure, or `None` for anything else: a
 * success, a result still loading or refreshing, or a defect.
 *
 * @internal
 */
export const settledError = (value: unknown): Option.Option<unknown> =>
	AsyncResult.isAsyncResult(value) &&
	AsyncResult.isFailure(value) &&
	!value.waiting
		? Cause.findErrorOption(value.cause)
		: Option.none();

/**
 * An atom's current value in the registry, without starting it: its node's
 * value, or a hydrated value no read has decoded yet.
 *
 * @internal
 */
export const peek = (
	registry: AtomRegistry.AtomRegistry,
	// oxlint-disable-next-line typescript/no-explicit-any -- any atom's result
	atom: Atom.Atom<any>,
): Option.Option<unknown> => {
	const serializable = Atom.isSerializable(atom)
		? atom[Atom.SerializableTypeId]
		: undefined;
	const node = registry
		.getNodes()
		.get(serializable === undefined ? atom : serializable.key);
	if (node !== undefined) {
		return node.valueOption();
	}
	if (
		serializable === undefined ||
		!registry.preloadedSerializable.has(serializable.key)
	) {
		return Option.none();
	}
	// SAFETY: the registry holds the encoded JSON `Hydration.hydrate` was
	// given, which AtomRegistry decodes with the same cast.
	const encoded = registry.preloadedSerializable.get(
		serializable.key,
	) as Schema.Json;
	try {
		return Option.some(serializable.decode(encoded));
	} catch {
		return Option.none();
	}
};

const never = new Promise<never>(() => {});

const Never = (): React.ReactNode => React.use(never);

const subscribe = () => () => {};
const onClient = () => false;
const onServer = () => true;

const noReset = () => {};

/** Whether this render runs on the server: anywhere without a `window`. */
const isServer = (): boolean => !("window" in globalThis);

/**
 * Renders a boundary's handler on the server in place of its children when
 * `find` finds a failure the boundary catches, since React's server
 * renderer runs no error boundaries: a read that throws there fails the
 * response, or leaves the page to the browser.
 *
 * In the browser, hydration keeps that HTML: the children suspend inside
 * the same `Suspense` without being compared with it. Once hydrated, the
 * children render, the read throws, and the boundary catches it as it
 * would in the browser, so the handler gets a `reset` that works.
 *
 * @internal
 */
export const Prerendered = (props: {
	readonly children?: React.ReactNode | undefined;
	readonly find: Find;
}): React.ReactNode => {
	const id = React.useId();
	const registry = React.useContext(RegistryContext);
	const hydrating = React.useSyncExternalStore(subscribe, onClient, onServer);
	const [rendered] = React.useState(
		() => hydrating && !isServer() && document.getElementById(id) !== null,
	);
	if (isServer()) {
		const caught = props.find(registry);
		if (caught === undefined) {
			return props.children;
		}
		// SAFETY: `find` found the handler by the error's `_tag`.
		const error = caught.error as never;
		return (
			<React.Suspense fallback={null}>
				<template id={id} />
				<caught.Handler error={error} reset={noReset} />
			</React.Suspense>
		);
	}
	if (!rendered) {
		return props.children;
	}
	return (
		<React.Suspense fallback={null}>
			{hydrating ? <Never /> : props.children}
		</React.Suspense>
	);
};
