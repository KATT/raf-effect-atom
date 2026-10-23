import { createFileRoute, notFound } from "@tanstack/react-router";
import { Option, Predicate, Schema } from "effect";
import { AsyncResult } from "effect/reactivity";
import { Loader } from "raf-effect-atom";

import { assignee, issue, IssueParams } from "~/issues.ts";

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

// #region guarded
export const GuardedRoute = createFileRoute("/issues/$id")({
	params: {
		parse: (params) => Schema.decodeUnknownSync(IssueParams)(params),
		stringify: Schema.encodeSync(IssueParams),
	},
	loader: async ({ context, params }) => {
		// The check: GetIssue fails with Unauthorized for a signed-out user.
		const issueHandle = await context.atoms.ensure(issue, params.id);
		if (AsyncResult.isFailure(Loader.result(issueHandle))) {
			// The assignee never starts, so the page carries none of it.
			return { assignee: undefined, issue: issueHandle };
		}
		return {
			assignee: context.atoms.prefetch(assignee, params.id),
			issue: issueHandle,
		};
	},
});
// #endregion guarded
