import { createFileRoute } from "@tanstack/react-router";
import { Schema } from "effect";
import { Loader } from "raf-effect-atom";
import { RouteLoader } from "raf-effect-atom/tanstack-router";

import { assignee, issue, IssueIdFromString } from "~/issues.ts";

// #region effect-loader
export const Route = createFileRoute("/issues/$id")({
	params: {
		parse: (params) => ({
			id: Schema.decodeSync(IssueIdFromString)(params.id),
		}),
	},
	loader: (args) =>
		RouteLoader.all(args, {
			assignee: Loader.prefetch(assignee, args.params.id),
			issue: Loader.ensure(issue, args.params.id).pipe(
				// Only IssueNotFound becomes a 404. Unauthorized and
				// RpcClientError stay in the result, for the page's boundaries.
				Loader.catchTags({
					IssueNotFound: (error) =>
						//             ^?
						RouteLoader.notFound({ data: { id: error.id } }),
				}),
			),
		}),
});
// #endregion effect-loader
