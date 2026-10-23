import {
	Comment,
	CommentId,
	type IssueId,
	User,
	UserId,
} from "@examples/contract";
import {
	CommentComposer,
	CommentItem,
	CommentSkeletons,
} from "@examples/kit/components/comments";
import { LoadMore } from "@examples/kit/components/load-more";
import { warnMockDbWrite } from "@examples/kit/lib/mock-db-toast";
import { RegistryContext, useAtomSet } from "@effect/atom-react";
import { useForm } from "@tanstack/react-form";
import { Cause, DateTime, Exit, Option, Predicate } from "effect";
import { type Handle, Loader, useAtomResult } from "raf-effect-atom";
import { Suspense, use, useState } from "react";

import { useIssueBoundary } from "~/boundaries.tsx";
import { addComment, commentPage, refreshIssues } from "~/issues.ts";

/** The author a comment shows while it saves; the server sets the real one. */
const you = new User({ id: UserId.make("you"), name: "You", title: "" });

/** The comments, newest first, one page per atom, under the new comment's form. */
export function Comments(props: {
	readonly issueId: IssueId;
	readonly page: Handle<typeof commentPage>;
}) {
	return (
		<section className="grid gap-3">
			<NewComment issueId={props.issueId} />
			<ul className="grid gap-3">
				<CommentPage page={props.page} />
			</ul>
		</section>
	);
}

function CommentPage(props: { readonly page: Handle<typeof commentPage> }) {
	const result = useAtomResult(useIssueBoundary(commentPage), props.page);
	const [more, setMore] = useState<Handle<typeof commentPage>>();
	const registry = use(RegistryContext);
	const [issueId, cursor] = props.page.args;
	const page = result.value;
	const next = page.nextCursor;
	return (
		<>
			{cursor === 0 ? (
				<h2 className="font-semibold">
					{page.total === 1 ? "1 comment" : `${page.total} comments`}
				</h2>
			) : null}
			{page.comments.map((comment) => (
				<CommentItem
					comment={comment}
					fadeIn={cursor > 0}
					key={comment.id}
					pending={false}
				/>
			))}
			{next === null ? null : more ? (
				<Suspense fallback={<CommentSkeletons count={3} />}>
					<CommentPage page={more} />
				</Suspense>
			) : (
				<LoadMore
					onLoad={() => {
						// Starts the next page here, not in its reader's render.
						setMore(Loader.make(registry).prefetch(commentPage, issueId, next));
					}}
				/>
			)}
		</>
	);
}

/**
 * The new comment's form, with TanStack Form. While it saves, the comment
 * shows below it as pending; the comment's id is picked here, so a retried
 * `AddComment` doesn't post it twice.
 */
function NewComment(props: { readonly issueId: IssueId }) {
	const save = useAtomSet(addComment, { mode: "promiseExit" });
	const [posting, setPosting] = useState<Comment | undefined>(undefined);
	const form = useForm({
		defaultValues: { body: "" },
		onSubmit: async (submit) => {
			const body = submit.value.body.trim();
			const id = CommentId.make(crypto.randomUUID());
			setPosting(
				new Comment({
					author: you,
					body,
					createdAt: DateTime.nowUnsafe(),
					id,
					issueId: props.issueId,
				}),
			);
			warnMockDbWrite();
			const exit = await save({
				...refreshIssues,
				payload: { body, id, issueId: props.issueId },
			});
			setPosting(undefined);
			if (Exit.isSuccess(exit)) {
				submit.formApi.reset();
				return;
			}
			const error = Option.match(Cause.findErrorOption(exit.cause), {
				onNone: () => "Couldn't post the comment",
				onSome: (failure) =>
					Predicate.isTagged(failure, "EmptyComment")
						? "Comment can't be empty"
						: `Couldn't post the comment: ${failure.message}`,
			});
			submit.formApi.setFieldMeta("body", (meta) => ({
				...meta,
				errorMap: { ...meta.errorMap, onSubmit: error },
			}));
		},
	});

	return (
		<>
			<form
				className="grid gap-2"
				onSubmit={(event) => {
					event.preventDefault();
					void form.handleSubmit();
				}}
			>
				<form.Field
					name="body"
					validators={{
						onSubmit: (field) =>
							field.value.trim() === "" ? "Comment can't be empty" : undefined,
					}}
				>
					{(field) => (
						<form.Subscribe selector={(state) => state.isSubmitting}>
							{(isSubmitting) => (
								<CommentComposer
									error={field.state.meta.errors.find(Predicate.isString)}
									onBlur={field.handleBlur}
									onChange={field.handleChange}
									pending={isSubmitting}
									value={field.state.value}
								/>
							)}
						</form.Subscribe>
					)}
				</form.Field>
			</form>
			{posting === undefined ? null : (
				<ul>
					<CommentItem comment={posting} fadeIn={false} pending />
				</ul>
			)}
		</>
	);
}
