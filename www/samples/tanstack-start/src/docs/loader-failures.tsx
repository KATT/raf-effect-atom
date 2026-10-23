import { createFileRoute, notFound } from "@tanstack/react-router";
import { Option, Predicate, Schema } from "effect";
import { AsyncResult } from "effect/reactivity";

import { issue, IssueIdFromString } from "~/issues.ts";

// #region not-found
export const Route = createFileRoute("/issues/$id")({
	params: {
		parse: (params) => ({
			id: Schema.decodeSync(IssueIdFromString)(params.id),
		}),
	},
	loader: async ({ context, params }) => {
		const result = await context.atoms.ensure(issue(params.id));
		const error = AsyncResult.error(result);
		//    ^?
		// Only IssueNotFound becomes a 404. Unauthorized and RpcClientError
		// stay in the result, for the page's boundaries.
		if (
			Option.isSome(error) &&
			Predicate.isTagged(error.value, "IssueNotFound")
		) {
			throw notFound();
		}
	},
});
// #endregion not-found
