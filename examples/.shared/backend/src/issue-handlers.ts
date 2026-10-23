import { CurrentUser, IssueRpcs } from "@examples/contract";
import { Issues } from "@examples/db";
import { Effect } from "effect";

/** The handlers without `Issues` provided, so tests can seed their own. */
export const IssueHandlersNoDeps = IssueRpcs.toLayer(
	Effect.gen(function* () {
		const issues = yield* Issues;

		return IssueRpcs.of({
			AddComment: (payload) =>
				Effect.flatMap(CurrentUser, (user) => issues.addComment(payload, user)),
			CountIssues: () => issues.count(),
			GetIssue: (payload) => issues.get(payload.id),
			GetIssueAssignee: (payload) => issues.getAssignee(payload.issueId),
			ListComments: (payload) => issues.listComments(payload),
			ListIssues: (payload) => issues.list(payload),
			SetStatus: (payload) => issues.setStatus(payload.id, payload.status),
			UpdateBody: (payload) => issues.updateBody(payload.id, payload.body),
			UpdateTitle: (payload) => issues.updateTitle(payload.id, payload.title),
		});
	}),
);
