import * as Option from "effect/Option";
import * as Predicate from "effect/Predicate";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as React from "react";

import * as Leases from "./leases.ts";

/** What a development read does when it starts an atom nothing started. */
export type Mode = "off" | "throw" | "warn";

export const ModeContext: React.Context<Mode> =
	React.createContext<Mode>("warn");

const docs = "https://raf-effect-atom.katt.dev/docs/request-waterfalls";

/** Whether the registry has `atom`'s node, or a hydrated value for it. */
export const isStarted = (
	registry: AtomRegistry.AtomRegistry,
	atom: Atom.Atom<unknown>,
): boolean => {
	const key = Leases.keyOf(atom);
	return (
		registry.getNodes().has(key) ||
		(Predicate.isString(key) && registry.preloadedSerializable.has(key))
	);
};

const isLoading = (node: AtomRegistry.Node<unknown>): boolean => {
	const value = Option.getOrUndefined(node.valueOption());
	return AsyncResult.isAsyncResult(value) && AsyncResult.isInitial(value);
};

/**
 * The nodes `registry.get` created that load on their own: `Initial`, with
 * no `Initial` parent. A derived atom over a source that is loading or
 * loaded isn't one, so reading through `Atom.map` or a wrapper over an atom
 * a loader started reports nothing.
 */
const startedLoading = (
	registry: AtomRegistry.AtomRegistry,
	atom: Atom.Atom<unknown>,
	before: ReadonlySet<Atom.Atom<unknown> | string>,
): ReadonlyArray<AtomRegistry.Node<unknown>> => {
	const root = registry.getNodes().get(Leases.keyOf(atom));
	const started: Array<AtomRegistry.Node<unknown>> = [];
	const seen = new Set<AtomRegistry.Node<unknown>>();
	const queue = root === undefined ? [] : [root];
	for (const node of queue) {
		if (seen.has(node) || before.has(Leases.keyOf(node.atom))) {
			continue;
		}
		seen.add(node);
		if (isLoading(node) && !Array.from(node.parents).some(isLoading)) {
			started.push(node);
		}
		queue.push(...node.parents);
	}
	return started;
};

const nameOf = (atom: Atom.Atom<unknown>): string => {
	const key = Leases.keyOf(atom);
	return atom.label?.[0] ?? (Predicate.isString(key) ? key : "an atom");
};

const message = (read: string, started: string): string =>
	`raf-effect-atom: rendering ${read === started ? `read ${read}` : `read ${read}, which started ${started}`} before anything else had started it, so its request waits for this render: a request waterfall. Start it before render and pass its handle down, from the route's loader or the server component (atoms.prefetch(source, ...args) or atoms.ensure). If the state that picks it, such as a page, a filter or an open dialog, isn't in the URL, put it there so the loader can. As escape hatches for state that can't be in the URL: start it in the event handler that changes the state (Loader.make(registry).prefetch), or, if its input only exists in render, read it with useAtomResult(source, useWaterfall(source, ...args)). ${docs}`;

const warned = new WeakMap<AtomRegistry.AtomRegistry, Set<string>>();

/**
 * The nodes a read started in throw mode, with the error. React renders a
 * component that threw once more before it gives up, and that render finds
 * the node, so the error stays with the node.
 */
const thrown = new WeakMap<AtomRegistry.Node<unknown>, Error>();

/**
 * Reads `atom`, reporting by `mode` when the read starts an atom no loader,
 * server component, event handler or `useWaterfall` started. Development
 * only: callers skip it in production builds.
 */
export const check = (
	registry: AtomRegistry.AtomRegistry,
	atom: Atom.Atom<unknown>,
	mode: Mode,
): void => {
	if (mode === "off") {
		return;
	}
	if (isStarted(registry, atom)) {
		const node = registry.getNodes().get(Leases.keyOf(atom));
		const error = mode === "throw" && node ? thrown.get(node) : undefined;
		if (error !== undefined) {
			throw error;
		}
		return;
	}
	const before = new Set(registry.getNodes().keys());
	registry.get(atom);
	const started = startedLoading(registry, atom, before);
	const first = started[0];
	if (first === undefined) {
		return;
	}
	const text = message(nameOf(atom), nameOf(first.atom));
	if (mode === "throw") {
		const error = new Error(text);
		const node = registry.getNodes().get(Leases.keyOf(atom));
		if (node !== undefined) {
			thrown.set(node, error);
		}
		throw error;
	}
	let seen = warned.get(registry);
	if (seen === undefined) {
		seen = new Set();
		warned.set(registry, seen);
	}
	if (!seen.has(text)) {
		seen.add(text);
		// oxlint-disable-next-line no-console -- a development warning, like React's: the console shows the rendering component's stack.
		console.warn(text);
	}
};
