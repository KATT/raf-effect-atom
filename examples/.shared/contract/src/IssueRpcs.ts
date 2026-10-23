import { Schema } from "effect";
import { Rpc, RpcGroup } from "effect/rpc";

import { Authorization } from "./Authorization.ts";
import {
	Comment,
	CommentId,
	CommentPage,
	Cursor,
	Issue,
	IssueCounts,
	IssueId,
	IssueListInput,
	IssuePage,
	IssueStatus,
	User,
} from "./Issue.ts";
import {
	EmptyBody,
	EmptyComment,
	EmptyTitle,
	IssueNotFound,
} from "./IssueErrors.ts";
import { Latency } from "./Latency.ts";

/**
 * The issue tracker's procedures. Each declares only the errors it can raise;
 * `Unauthorized` comes from {@link Authorization}, on every procedure.
 */
export const IssueRpcs = RpcGroup.make(
	Rpc.make("ListIssues", {
		payload: { ...IssueListInput.fields, cursor: Cursor },
		success: IssuePage,
	}),
	Rpc.make("CountIssues", { success: IssueCounts }),
	Rpc.make("GetIssue", {
		error: IssueNotFound,
		payload: { id: IssueId },
		success: Issue,
	}),
	/**
	 * The issue's assignee in one round trip, by the issue's id, so a page can
	 * ask for it beside the issue instead of after it.
	 */
	Rpc.make("GetIssueAssignee", {
		error: IssueNotFound,
		payload: { issueId: IssueId },
		success: User,
	}),
	Rpc.make("UpdateTitle", {
		error: Schema.Union([IssueNotFound, EmptyTitle]),
		payload: { id: IssueId, title: Schema.String },
		success: Issue,
	}),
	Rpc.make("UpdateBody", {
		error: Schema.Union([IssueNotFound, EmptyBody]),
		payload: { body: Schema.String, id: IssueId },
		success: Issue,
	}),
	Rpc.make("SetStatus", {
		error: IssueNotFound,
		payload: { id: IssueId, status: IssueStatus },
		success: Issue,
	}),
	/** Newest first. */
	Rpc.make("ListComments", {
		error: IssueNotFound,
		payload: { cursor: Cursor, issueId: IssueId },
		success: CommentPage,
	}),
	/** Idempotent: sending the same `id` again returns the saved comment. */
	Rpc.make("AddComment", {
		error: Schema.Union([IssueNotFound, EmptyComment]),
		payload: { body: Schema.String, id: CommentId, issueId: IssueId },
		success: Comment,
	}),
)
	.middleware(Latency)
	.middleware(Authorization);
