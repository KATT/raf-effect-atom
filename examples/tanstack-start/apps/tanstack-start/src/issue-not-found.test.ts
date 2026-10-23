import { IssueId, IssueNotFound } from "@examples/contract";
import { assert, describe, it } from "@effect/vitest";
import { Cause, Effect, Option } from "effect";
import { AsyncResult, AtomRegistry } from "effect/reactivity";
import { Hydration, Loader, RequestRegistry } from "raf-effect-atom";

import { issue, requestCookie } from "./issues.ts";

describe("server rendering", () => {
	it.effect(
		"sends a server-side IssueNotFound to the browser as an IssueNotFound",
		() =>
			Effect.gen(function* () {
				const missing = issue(IssueId.make(999));
				// As `getRouter` makes it for a page request, without latency.
				const server = RequestRegistry.make();
				server.set(requestCookie, "db-latency=0");
				yield* Effect.promise(() => Loader.make(server).ensure(missing));
				// The router's serializer carries the dehydrated state as data:
				// class instances lose their prototypes on the way.
				const sent = structuredClone(Hydration.dehydrate(server));
				server.dispose();

				const browser = AtomRegistry.make();
				Hydration.hydrate(browser, sent);
				const result = browser.get(Hydration.hydrated(missing));
				assert.isTrue(AsyncResult.isFailure(result));
				const error = AsyncResult.isFailure(result)
					? Cause.findErrorOption(result.cause)
					: Option.none();
				assert.instanceOf(Option.getOrUndefined(error), IssueNotFound);
				assert.deepStrictEqual(
					Option.getOrUndefined(error),
					new IssueNotFound({ id: IssueId.make(999) }),
				);
			}),
	);
});
