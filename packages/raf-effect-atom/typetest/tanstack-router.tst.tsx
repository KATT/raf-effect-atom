import { hole } from "effect";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import {
	createRootRouteWithContext,
	createRoute,
	createRouter,
} from "@tanstack/react-router";
import { describe, expect, it } from "tstyche";

import { Loader } from "../src/index.ts";
import { setupRouterAtoms } from "../src/tanstack-router.tsx";
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

	it("gives loaders the verbs, typed by the atom", () => {
		createRoute({
			getParentRoute: () => rootRoute,
			loader: async (match) => {
				const result = await match.context.atoms.ensure(issue(1));
				expect(result).type.toBeAssignableTo<Issue>();
			},
			path: "/",
		});
	});
});
