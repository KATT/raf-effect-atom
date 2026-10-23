import { createFileRoute, notFound } from "@tanstack/react-router";
import { Option, Predicate, Schema } from "effect";
import { AsyncResult } from "effect/reactivity";
import { Loader } from "raf-effect-atom";

import { issue, IssueParams } from "~/issues.ts";

// #region not-found
export const Route = createFileRoute("/issues/$id")({
	params: {
		parse: (params) => Schema.decodeUnknownSync(IssueParams)(params),
		stringify: Schema.encodeSync(IssueParams),
	},
	loader: async ({ context, params }) => {
		const handle = await context.atoms.ensure(issue, params.id);
		const error = AsyncResult.error(Loader.result(handle));
		//    ^?
		// Only IssueNotFound becomes a 404. Unauthorized and RpcClientError
		// stay in the result, for the page's boundaries.
		if (
			Option.isSome(error) &&
			Predicate.isTagged(error.value, "IssueNotFound")
		) {
			throw notFound();
		}
		return { issue: handle };
	},
});
// #endregion not-found
