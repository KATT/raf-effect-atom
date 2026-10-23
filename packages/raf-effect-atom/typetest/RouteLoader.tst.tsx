import {
	createRootRouteWithContext,
	createRoute,
} from "@tanstack/react-router";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { describe, expect, it } from "tstyche";

import { type Handle, type LoadedHandle, Loader } from "../src/index.ts";
import { RouteLoader } from "../src/TanStackRouter.tsx";
import { issue, type IssueNotFound } from "../test/fixtures/issues.ts";

const ensureIssue = Loader.ensure(issue, 1);
type Issue = LoadedHandle<typeof issue>;

const rootRoute = createRootRouteWithContext<{
	readonly atoms: Loader.Loader;
}>()();

declare const args: RouteLoader.Args;

describe("RouteLoader.run", () => {
	it("returns the Effect's success as the route's loader data", () => {
		const route = createRoute({
			getParentRoute: () => rootRoute,
			loader: (match) =>
				RouteLoader.run(
					match,
					Effect.gen(function* () {
						return yield* Loader.ensure(issue, Number(match.params.id));
					}),
				),
			path: "/issues/$id",
		});
		expect<typeof route.types.loaderData>().type.toBe<Issue>();
	});

	it("takes the router's signals", () => {
		createRoute({
			beforeLoad: (match) =>
				RouteLoader.run(match, RouteLoader.redirect({ to: "/" })),
			getParentRoute: () => rootRoute,
			loader: (match) => RouteLoader.run(match, RouteLoader.notFound()),
			path: "/a",
		});
	});

	it("rejects any other failure", () => {
		expect(RouteLoader.run).type.not.toBeCallableWith(
			args,
			Effect.fail("boom"),
		);
	});

	it("rejects a service other than the registry", () => {
		class Now extends Context.Service<Now, number>()("Now") {}
		expect(RouteLoader.run).type.not.toBeCallableWith(
			args,
			Effect.service(Now),
		);
	});
});

describe("RouteLoader.all", () => {
	it("returns the struct of the verbs' handles", () => {
		const route = createRoute({
			getParentRoute: () => rootRoute,
			loader: (match) =>
				RouteLoader.all(match, {
					issue: Loader.ensure(issue, Number(match.params.id)),
					next: Loader.prefetch(issue, Number(match.params.id) + 1),
				}),
			path: "/issues/$id",
		});
		expect<typeof route.types.loaderData>().type.toBe<{
			issue: Issue;
			next: Handle<typeof issue>;
		}>();
	});
});

describe("Loader.catchTags", () => {
	it("keys the handlers by the atom's tags, and adds their failures", () => {
		const program = ensureIssue.pipe(
			Loader.catchTags({
				IssueNotFound: (error) => {
					expect(error).type.toBe<IssueNotFound>();
					return RouteLoader.notFound();
				},
			}),
		);
		expect(program).type.toBe<
			Effect.Effect<Issue, RouteLoader.NotFound, AtomRegistry.AtomRegistry>
		>();
	});

	it("rejects a tag the atom can't fail with", () => {
		expect(ensureIssue.pipe).type.not.toBeCallableWith(
			Loader.catchTags({ Missing: () => RouteLoader.notFound() }),
		);
	});
});
