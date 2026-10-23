"use client";

import type { Comment } from "@examples/contract";
import { formatDayAndTime } from "@examples/kit/lib/dates";
import { Button } from "@examples/ui/components/button";
import { Skeleton } from "@examples/ui/components/skeleton";
import { Textarea } from "@examples/ui/components/textarea";
import { cn } from "@examples/ui/lib/utils";
import { Loader2 } from "lucide-react";

const commentClassName = "rounded-lg border p-3";

/**
 * One comment in the list. `pending` is a comment that hasn't saved yet;
 * `fadeIn` fades in a comment from a page loaded after the first.
 */
export function CommentItem(props: {
	readonly comment: Comment;
	readonly fadeIn: boolean;
	readonly pending: boolean;
}) {
	const comment = props.comment;
	return (
		<li
			aria-busy={props.pending || undefined}
			className={cn(
				commentClassName,
				props.pending
					? "animate-pulse border-dashed bg-muted/40 text-muted-foreground"
					: props.fadeIn && "animate-in duration-500 fade-in",
			)}
		>
			<div className="mb-1 flex gap-2 text-xs text-muted-foreground">
				<span
					className={cn(
						"font-medium",
						props.pending ? "text-muted-foreground" : "text-foreground",
					)}
				>
					{comment.author.name}
				</span>
				<span>
					{props.pending ? "Posting…" : formatDayAndTime(comment.createdAt)}
				</span>
			</div>
			<p className="text-sm">{comment.body}</p>
		</li>
	);
}

/**
 * The new comment's textarea, its error and the submit button, for inside the
 * app's form. The app's form library owns the value.
 */
export function CommentComposer(props: {
	readonly error: string | undefined;
	readonly onBlur: () => void;
	readonly onChange: (body: string) => void;
	readonly pending: boolean;
	readonly value: string;
}) {
	return (
		<>
			<Textarea
				aria-invalid={props.error === undefined ? undefined : true}
				disabled={props.pending}
				name="body"
				onBlur={props.onBlur}
				onChange={(event) => {
					props.onChange(event.target.value);
				}}
				placeholder="Add a comment"
				value={props.value}
			/>
			{props.error === undefined ? null : (
				<p className="text-sm text-destructive">{props.error}</p>
			)}
			<Button
				className="justify-self-end"
				disabled={props.pending}
				type="submit"
				variant={props.pending ? "secondary" : "default"}
			>
				{props.pending ? <Loader2 className="animate-spin" /> : null}
				{props.pending ? "Posting…" : "Comment"}
			</Button>
		</>
	);
}

export function CommentSkeletons(props: { readonly count: number }) {
	return Array.from({ length: props.count }, (_, index) => (
		<li className={commentClassName} key={index}>
			<Skeleton className="mb-1 h-4 w-32" />
			<Skeleton className="h-5 w-full" />
		</li>
	));
}

export function CommentsSkeleton() {
	return (
		<div className="grid gap-3">
			<Skeleton className="h-6 w-32" />
			<Skeleton className="h-16" />
			<Skeleton className="h-16" />
		</div>
	);
}
