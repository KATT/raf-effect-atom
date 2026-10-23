import { hole } from "effect";
import * as Atom from "effect/reactivity/Atom";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import {
	createRootRouteWithContext,
	createRoute,
	createRouter,
} from "@tanstack/react-router";
import { describe, expect, it } from "tstyche";

import { type LoadedHandle, Loader } from "../src/index.ts";
import { makeRegistry, setupRouterAtoms } from "../src/tanstack-router.tsx";
import { issue } from "../test/fixtures/issues.ts";

type Issue = Loader.SettledResult<
	{ readonly id: number; readonly title: string },
	unknown
>;

const rootRoute = createRootRouteWithContext<{
	readonly atoms: Loader.Loader;
}>()();

describe("setupRouterAtoms", () => {
	it("takes a router and the registry its context's verbs run on", () => {
		const registry = hole<AtomRegistry.AtomRegistry>();
		const router = createRouter({
			context: { atoms: Loader.make(registry) },
			routeTree: rootRoute,
		});
		expect(setupRouterAtoms({ registry, router })).type.toBe<void>();
		expect(setupRouterAtoms).type.not.toBeCallableWith({ router });
	});

	it("makes registries that start with initial values for any atom", () => {
		const fetchAtom = Atom.readable((): typeof fetch => fetch);
		expect(
			makeRegistry({ initialValues: [Atom.initialValue(fetchAtom, fetch)] }),
		).type.toBe<AtomRegistry.AtomRegistry>();
		expect(makeRegistry).type.not.toBeCallableWith({
			initialValues: [fetchAtom],
		});
	});

	it("gives loaders the verbs, returning handles", () => {
		createRoute({
			getParentRoute: () => rootRoute,
			loader: async (match) => {
				const handle = await match.context.atoms.ensure(issue, 1);
				expect(handle).type.toBe<LoadedHandle<typeof issue>>();
				expect(Loader.result(handle)).type.toBeAssignableTo<Issue>();
				return { issue: handle };
			},
			path: "/",
		});
	});
});
