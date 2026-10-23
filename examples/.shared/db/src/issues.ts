import {
	Comment,
	type CommentId,
	CommentPage,
	EmptyBody,
	EmptyComment,
	EmptyTitle,
	Issue,
	IssueCounts,
	type IssueId,
	type IssueListInput,
	IssueNotFound,
	IssuePage,
	type IssueStatus,
	type User,
} from "@examples/contract";
import {
	Array,
	Config,
	Context,
	DateTime,
	Effect,
	Layer,
	Order,
	Random,
} from "effect";

import { seed, type Store } from "./seed.ts";

const ISSUES_PER_PAGE = 10;
const COMMENTS_PER_PAGE = 4;

/**
 * The latency this request asked for, in ms. The backend's `Latency`
 * middleware sets it from the `db-latency` cookie; without it, calls wait
 * `DB_LATENCY_MS`, or 400.
 */
export const DbLatency = Context.Reference<number | undefined>(
	"@examples/db/DbLatency",
	{ defaultValue: () => undefined },
);

export interface IssuePageInput extends IssueListInput {
	/** Index of the first issue to return. */
	readonly cursor: number;
}

export interface CommentPageInput {
	/** Index of the first comment to return. */
	readonly cursor: number;
	readonly issueId: IssueId;
}

export interface AddCommentInput {
	readonly body: string;
	readonly id: CommentId;
	readonly issueId: IssueId;
}

declare global {
	/** Survives dev-server module reloads, so edits aren't lost on save. */
	var exampleDbStore: Store | undefined;
}

const save = (store: Store, issue: Issue) => {
	store.issues.set(issue.id, issue);
	return issue;
};

/**
 * The example issue tracker's data, in memory behind a latency like a real
 * database's. Server-only: its key is one of the markers the bundle check
 * looks for in client output.
 */
export class Issues extends Context.Service<
	Issues,
	{
		/** Idempotent: a comment `id` that's already saved returns that comment. */
		addComment(
			input: AddCommentInput,
			author: User,
		): Effect.Effect<Comment, IssueNotFound | EmptyComment>;
		count(): Effect.Effect<IssueCounts>;
		get(id: IssueId): Effect.Effect<Issue, IssueNotFound>;
		/** The issue's assignee in one round trip, like a join. */
		getAssignee(issueId: IssueId): Effect.Effect<User, IssueNotFound>;
		list(input: IssuePageInput): Effect.Effect<IssuePage>;
		/** Newest first. */
		listComments(
			input: CommentPageInput,
		): Effect.Effect<CommentPage, IssueNotFound>;
		setStatus(
			id: IssueId,
			status: IssueStatus,
		): Effect.Effect<Issue, IssueNotFound>;
		updateBody(
			id: IssueId,
			body: string,
		): Effect.Effect<Issue, IssueNotFound | EmptyBody>;
		updateTitle(
			id: IssueId,
			title: string,
		): Effect.Effect<Issue, IssueNotFound | EmptyTitle>;
	}
>()("@examples/db/Issues") {
	/** Over the given tables. */
	static readonly layerStore = (store: Store) =>
		Layer.effect(
			Issues,
			Effect.gen(function* () {
				const defaultLatency = yield* Config.Number("DB_LATENCY_MS").pipe(
					Config.withDefault(400),
				);

				/** Every call waits like a database round trip: the latency ± 50%. */
				const latency = Effect.gen(function* () {
					const base = (yield* DbLatency) ?? defaultLatency;
					if (base > 0) {
						yield* Effect.sleep(base * (yield* Random.nextBetween(0.5, 1.5)));
					}
				});

				const get = Effect.fn("Issues.get")(function* (id: IssueId) {
					yield* latency;
					const issue = store.issues.get(id);
					if (!issue) {
						return yield* new IssueNotFound({ id });
					}
					return issue;
				});

				const getAssignee = Effect.fn("Issues.getAssignee")(function* (
					issueId: IssueId,
				) {
					const issue = yield* get(issueId);
					const assignee = store.users.get(issue.assigneeId);
					if (!assignee) {
						return yield* Effect.die(`No user ${issue.assigneeId}`);
					}
					return assignee;
				});

				const count = Effect.fn("Issues.count")(function* () {
					yield* latency;
					const issues = [...store.issues.values()];
					const withStatus = (status: IssueStatus) =>
						issues.filter((issue) => issue.status === status).length;
					return new IssueCounts({
						all: issues.length,
						closed: withStatus("closed"),
						in_progress: withStatus("in_progress"),
						open: withStatus("open"),
					});
				});

				const list = Effect.fn("Issues.list")(function* (
					input: IssuePageInput,
				) {
					yield* latency;
					const matching = Array.sortWith(
						[...store.issues.values()].filter(
							(issue) =>
								input.status === "all" || issue.status === input.status,
						),
						(issue) => issue.createdAt,
						input.sort === "newest"
							? Order.flip(DateTime.Order)
							: DateTime.Order,
					);
					const end = input.cursor + ISSUES_PER_PAGE;
					return new IssuePage({
						issues: matching.slice(input.cursor, end),
						nextCursor: end < matching.length ? end : null,
						total: matching.length,
					});
				});

				const listComments = Effect.fn("Issues.listComments")(function* (
					input: CommentPageInput,
				) {
					yield* latency;
					if (!store.issues.has(input.issueId)) {
						return yield* new IssueNotFound({ id: input.issueId });
					}
					const comments = store.comments
						.filter((comment) => comment.issueId === input.issueId)
						.toReversed();
					const end = input.cursor + COMMENTS_PER_PAGE;
					return new CommentPage({
						comments: comments.slice(input.cursor, end),
						nextCursor: end < comments.length ? end : null,
						total: comments.length,
					});
				});

				const setStatus = Effect.fn("Issues.setStatus")(function* (
					id: IssueId,
					status: IssueStatus,
				) {
					const issue = yield* get(id);
					return save(store, new Issue({ ...issue, status }));
				});

				const updateBody = Effect.fn("Issues.updateBody")(function* (
					id: IssueId,
					body: string,
				) {
					const issue = yield* get(id);
					const trimmed = body.trim();
					if (trimmed === "") {
						return yield* new EmptyBody();
					}
					return save(store, new Issue({ ...issue, body: trimmed }));
				});

				const updateTitle = Effect.fn("Issues.updateTitle")(function* (
					id: IssueId,
					title: string,
				) {
					const issue = yield* get(id);
					const trimmed = title.trim();
					if (trimmed === "") {
						return yield* new EmptyTitle();
					}
					return save(store, new Issue({ ...issue, title: trimmed }));
				});

				const addComment = Effect.fn("Issues.addComment")(function* (
					input: AddCommentInput,
					author: User,
				) {
					const createdAt = yield* DateTime.now;
					const issue = yield* get(input.issueId);
					const saved = store.comments.find(
						(comment) => comment.id === input.id,
					);
					if (saved) {
						return saved;
					}
					const body = input.body.trim();
					if (body === "") {
						return yield* new EmptyComment();
					}
					const comment = new Comment({
						author,
						body,
						createdAt,
						id: input.id,
						issueId: input.issueId,
					});
					store.comments.push(comment);
					save(
						store,
						new Issue({ ...issue, commentCount: issue.commentCount + 1 }),
					);
					return comment;
				});

				return Issues.of({
					addComment,
					count,
					get,
					getAssignee,
					list,
					listComments,
					setStatus,
					updateBody,
					updateTitle,
				});
			}),
		);

	/** The process-wide tables, which keep edits across module reloads. */
	static readonly layer = Layer.unwrap(
		Effect.sync(() => {
			globalThis.exampleDbStore ??= seed();
			return Issues.layerStore(globalThis.exampleDbStore);
		}),
	);

	/** Freshly seeded tables of its own, so tests don't see each other's edits. */
	static readonly layerTest = Layer.unwrap(
		Effect.sync(() => Issues.layerStore(seed())),
	);
}
