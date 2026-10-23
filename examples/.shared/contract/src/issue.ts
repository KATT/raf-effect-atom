import { Effect, Schema } from "effect";

export const IssueId = Schema.Int.check(Schema.isGreaterThan(0)).pipe(
	Schema.brand("IssueId"),
);
export type IssueId = typeof IssueId.Type;

export const UserId = Schema.String.pipe(Schema.brand("UserId"));
export type UserId = typeof UserId.Type;

/** Picked by the client, so an optimistic comment and the saved one match. */
export const CommentId = Schema.String.check(Schema.isUUID(4)).pipe(
	Schema.brand("CommentId"),
);
export type CommentId = typeof CommentId.Type;

export const IssueStatus = Schema.Literals(["open", "in_progress", "closed"]);
export type IssueStatus = typeof IssueStatus.Type;

/** Index of a page's first item. */
export const Cursor = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));

/**
 * What the issue list shows. Lives in the URL's search params; missing keys
 * get defaults. Pages are loaded by scrolling, so they stay out of the URL.
 */
export const IssueListInput = Schema.Struct({
	sort: Schema.Literals(["newest", "oldest"]).pipe(
		Schema.withDecodingDefault(Effect.succeed("newest" as const)),
	),
	status: Schema.Literals(["all", "open", "in_progress", "closed"]).pipe(
		Schema.withDecodingDefault(Effect.succeed("all" as const)),
	),
});
export type IssueListInput = typeof IssueListInput.Type;

export class User extends Schema.Class<User>("@examples/contract/User")({
	id: UserId,
	name: Schema.String,
	title: Schema.String,
}) {}

export class Issue extends Schema.Class<Issue>("@examples/contract/Issue")({
	assigneeId: UserId,
	body: Schema.String,
	commentCount: Schema.Int,
	createdAt: Schema.DateTimeUtc,
	id: IssueId,
	status: IssueStatus,
	title: Schema.String,
}) {}

export class Comment extends Schema.Class<Comment>(
	"@examples/contract/Comment",
)({
	author: User,
	body: Schema.String,
	createdAt: Schema.DateTimeUtc,
	id: CommentId,
	issueId: IssueId,
}) {}

const page = {
	nextCursor: Schema.NullOr(Cursor),
	total: Schema.Int,
};

export class IssuePage extends Schema.Class<IssuePage>(
	"@examples/contract/IssuePage",
)({
	...page,
	issues: Schema.Array(Issue),
}) {}

export class CommentPage extends Schema.Class<CommentPage>(
	"@examples/contract/CommentPage",
)({
	...page,
	comments: Schema.Array(Comment),
}) {}

export class IssueCounts extends Schema.Class<IssueCounts>(
	"@examples/contract/IssueCounts",
)({
	all: Schema.Int,
	closed: Schema.Int,
	in_progress: Schema.Int,
	open: Schema.Int,
}) {}
