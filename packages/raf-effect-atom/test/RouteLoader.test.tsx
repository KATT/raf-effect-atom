// @vitest-environment-options {"settings":{"enableJavaScriptEvaluation":true,"suppressInsecureJavaScriptEnvironmentWarning":true}}
import { assert, describe, it } from "@effect/vitest";
import { isNotFound, isRedirect } from "@tanstack/react-router";
import { screen } from "@testing-library/react";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";

import { Loader } from "../src/index.ts";
import { RouteLoader } from "../src/TanStackRouter.tsx";
import { issue, serve } from "./fixtures/issues.ts";
import { renderInBrowser, renderOnServer } from "./fixtures/router.tsx";

/** A loader's arguments over a fresh browser registry. */
const loaderArgs = () => {
	const registry = AtomRegistry.make();
	return {
		abortController: new AbortController(),
		context: { atoms: Loader.make(registry) },
		registry,
	};
};

/** A loader's rejection; its `cause` is what the router catches. */
const thrownBy = <A,>(loader: () => Promise<A>) =>
	Effect.flip(Effect.tryPromise(loader));

/** `ensure`s the issue, and turns `IssueNotFound` into the router's not-found. */
const ensureOrNotFound = (id: number) =>
	Loader.ensure(issue, id).pipe(
		Loader.catchTags({ IssueNotFound: () => RouteLoader.notFound() }),
	);

describe("RouteLoader.run", () => {
	it.live("runs the verbs on the context's registry", () =>
		Effect.gen(function* () {
			using _server = serve();
			const args = loaderArgs();
			const handle = yield* Effect.promise(() =>
				RouteLoader.run(args, Loader.ensure(issue, 1)),
			);
			assert.isTrue(AsyncResult.isSuccess(Loader.result(handle)));
			assert.strictEqual(args.registry.get(issue(1)), Loader.result(handle));
		}),
	);

	it.live("throws the router's not-found for NotFound", () =>
		Effect.gen(function* () {
			const rejection = yield* thrownBy(() =>
				RouteLoader.run(loaderArgs(), RouteLoader.notFound({ data: "x" })),
			);
			assert.isTrue(isNotFound(rejection.cause));
			assert.deepInclude(rejection.cause, { data: "x" });
		}),
	);

	it.live("throws the router's redirect for Redirect", () =>
		Effect.gen(function* () {
			const rejection = yield* thrownBy(() =>
				RouteLoader.run(loaderArgs(), RouteLoader.redirect({ href: "/login" })),
			);
			assert.isTrue(isRedirect(rejection.cause));
			assert.strictEqual(
				isRedirect(rejection.cause)
					? rejection.cause.headers.get("Location")
					: undefined,
				"/login",
			);
		}),
	);

	it.live("throws a defect as itself", () =>
		Effect.gen(function* () {
			const defect = new Error("boom");
			const rejection = yield* thrownBy(() =>
				RouteLoader.run(loaderArgs(), Effect.die(defect)),
			);
			assert.strictEqual(rejection.cause, defect);
		}),
	);

	it.live(
		"interrupts the Effect when the navigation aborts, and leaves its atoms loading",
		() =>
			Effect.gen(function* () {
				using server = serve();
				const args = loaderArgs();
				const loading = RouteLoader.run(
					args,
					Effect.gen(function* () {
						yield* Loader.prefetch(issue, 1);
						return yield* Effect.never;
					}),
				);
				args.abortController.abort();
				yield* thrownBy(() => loading);
				const handle = yield* Effect.promise(() =>
					args.context.atoms.ensure(issue, 1),
				);
				assert.isTrue(AsyncResult.isSuccess(Loader.result(handle)));
				assert.strictEqual(server.requests(1), 1);
			}),
	);
});

describe("RouteLoader.all", () => {
	it.live("runs the fields concurrently and returns their results", () =>
		Effect.gen(function* () {
			using _server = serve();
			const started = yield* Deferred.make<void>();
			const loaded = yield* Effect.promise(() =>
				RouteLoader.all(loaderArgs(), {
					issue: Loader.ensure(issue, 1),
					starts: Deferred.succeed(started, undefined),
					// Settles only if `starts` runs while it waits.
					waits: Deferred.await(started),
				}),
			);
			assert.isTrue(AsyncResult.isSuccess(Loader.result(loaded.issue)));
			assert.isTrue(loaded.starts);
		}),
	);
});

describe("Loader.catchTags", () => {
	it.live("fails with the handler's failure for a matching tag", () =>
		Effect.gen(function* () {
			using _server = serve({ 1: ["missing"] });
			const rejection = yield* thrownBy(() =>
				RouteLoader.run(loaderArgs(), ensureOrNotFound(1)),
			);
			assert.isTrue(isNotFound(rejection.cause));
		}),
	);

	it.live("returns the handle for another tag, for a boundary to render", () =>
		Effect.gen(function* () {
			using _server = serve({ 1: ["signed-out"] });
			const handle = yield* Effect.promise(() =>
				RouteLoader.run(loaderArgs(), ensureOrNotFound(1)),
			);
			assert.isTrue(AsyncResult.isFailure(Loader.result(handle)));
		}),
	);

	it("renders the router's not-found on the server, and the page for another tag", async () => {
		using _server = serve({ 1: ["missing"], 2: ["signed-out"] });
		const missing = await renderOnServer("/checked/1");
		assert.include(missing.html, "Router not found");

		const signedOut = await renderOnServer("/checked/2");
		assert.include(signedOut.html, "Not an IssueNotFound: Unauthorized");
		using _app = await renderInBrowser("/checked/2", signedOut.html);
		assert.isDefined(screen.getByText("Not an IssueNotFound: Unauthorized"));
	});
});
