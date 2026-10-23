"use client";

import type { Issue } from "@examples/contract";
import { formatDay } from "@examples/kit/lib/dates";
import { warnMockDbWrite } from "@examples/kit/lib/mock-db-toast";
import { cn } from "@examples/ui/lib/utils";
import { useAtomSet } from "@effect/atom-react";
import { useForm } from "@tanstack/react-form";
import { Cause, Exit, Option, Predicate } from "effect";
import { type Handle, useAtomResult } from "raf-effect-atom";

import { useIssueBoundary } from "~/boundaries.tsx";
import { StatusSelect } from "~/components/status-select.tsx";
import { issue, refreshIssues, updateBody, updateTitle } from "~/issues.ts";

/** The issue's title, status, date and description, each editable in place. */
export function IssueDetail(props: { readonly issue: Handle<typeof issue> }) {
	const result = useAtomResult(useIssueBoundary().wrap(issue), props.issue);
	const current = result.value;
	return (
		<div className="grid gap-6">
			<div className="flex items-baseline gap-2">
				<EditTitle issue={current} key={current.title} />
				<span className="shrink-0 text-lg text-muted-foreground">
					#{current.id}
				</span>
			</div>
			<div className="flex items-center gap-3 text-sm text-muted-foreground">
				<StatusSelect
					align="start"
					issueId={current.id}
					status={current.status}
				/>
				<span>Opened {formatDay(current.createdAt)}</span>
			</div>
			<EditBody issue={current} key={current.body} />
		</div>
	);
}

/** The message for a failed save: the procedure's own error, or the request's. */
const saveError = <E extends { readonly message: string }>(
	exit: Exit.Exit<unknown, E>,
	known: (error: E) => string | undefined,
) => {
	if (Exit.isSuccess(exit)) {
		return undefined;
	}
	return Option.match(Cause.findErrorOption(exit.cause), {
		onNone: () => "Couldn't save",
		onSome: (error: E) => known(error) ?? `Couldn't save: ${error.message}`,
	});
};

const editableClassName = cn(
	"w-full rounded-md bg-transparent px-1.5 outline-none",
	"-mx-1.5 transition-[box-shadow,background-color]",
	"hover:bg-muted/60 focus:bg-muted/60 focus-visible:ring-[3px] focus-visible:ring-ring/50",
);

/**
 * The title, editable in place with TanStack Form. Enter or blur saves;
 * Escape cancels. The server's `EmptyTitle` shows under it.
 */
function EditTitle(props: { readonly issue: Issue }) {
	const save = useAtomSet(updateTitle, { mode: "promiseExit" });
	const form = useForm({
		defaultValues: { title: props.issue.title },
		onSubmit: async (submit) => {
			const title = submit.value.title.trim();
			if (title === props.issue.title) {
				return;
			}
			warnMockDbWrite();
			const exit = await save({
				...refreshIssues,
				payload: { id: props.issue.id, title },
			});
			const error = saveError(exit, (failure) =>
				Predicate.isTagged(failure, "EmptyTitle")
					? "Title can't be empty"
					: undefined,
			);
			if (error !== undefined) {
				submit.formApi.setFieldMeta("title", (meta) => ({
					...meta,
					errorMap: { ...meta.errorMap, onSubmit: error },
				}));
			}
		},
	});

	return (
		<form
			className="grid min-w-0 flex-1 gap-1"
			onSubmit={(event) => {
				event.preventDefault();
				void form.handleSubmit();
			}}
		>
			<form.Field name="title">
				{(field) => (
					<>
						<form.Subscribe selector={(state) => state.isSubmitting}>
							{(isSubmitting) => (
								<input
									aria-label="Title"
									className={cn(
										editableClassName,
										"py-0.5 text-2xl font-semibold tracking-tight sm:text-3xl",
										isSubmitting && "opacity-70",
									)}
									disabled={isSubmitting}
									name={field.name}
									onBlur={() => {
										field.handleBlur();
										void form.handleSubmit();
									}}
									onChange={(event) => {
										field.handleChange(event.target.value);
									}}
									onKeyDown={(event) => {
										if (event.key === "Escape") {
											form.reset();
											event.currentTarget.blur();
										}
									}}
									value={field.state.value}
								/>
							)}
						</form.Subscribe>
						<FieldError errors={field.state.meta.errors} />
					</>
				)}
			</form.Field>
		</form>
	);
}

/**
 * The description, editable in place with TanStack Form. Blur or
 * Cmd/Ctrl+Enter saves; Escape cancels. The server's `EmptyBody` shows under
 * it.
 */
function EditBody(props: { readonly issue: Issue }) {
	const save = useAtomSet(updateBody, { mode: "promiseExit" });
	const form = useForm({
		defaultValues: { body: props.issue.body },
		onSubmit: async (submit) => {
			const body = submit.value.body.trim();
			if (body === props.issue.body) {
				return;
			}
			warnMockDbWrite();
			const exit = await save({
				...refreshIssues,
				payload: { body, id: props.issue.id },
			});
			const error = saveError(exit, (failure) =>
				Predicate.isTagged(failure, "EmptyBody")
					? "Description can't be empty"
					: undefined,
			);
			if (error !== undefined) {
				submit.formApi.setFieldMeta("body", (meta) => ({
					...meta,
					errorMap: { ...meta.errorMap, onSubmit: error },
				}));
			}
		},
	});

	return (
		<form
			className="grid gap-1"
			onSubmit={(event) => {
				event.preventDefault();
				void form.handleSubmit();
			}}
		>
			<form.Field name="body">
				{(field) => (
					<>
						<form.Subscribe selector={(state) => state.isSubmitting}>
							{(isSubmitting) => (
								<textarea
									aria-label="Description"
									className={cn(
										editableClassName,
										"min-h-28 resize-y py-1 text-sm whitespace-pre-line",
										isSubmitting && "opacity-70",
									)}
									disabled={isSubmitting}
									name={field.name}
									onBlur={() => {
										field.handleBlur();
										void form.handleSubmit();
									}}
									onChange={(event) => {
										field.handleChange(event.target.value);
									}}
									onKeyDown={(event) => {
										if (event.key === "Escape") {
											form.reset();
											event.currentTarget.blur();
										}
										if (
											event.key === "Enter" &&
											(event.metaKey || event.ctrlKey)
										) {
											event.preventDefault();
											event.currentTarget.blur();
										}
									}}
									rows={5}
									value={field.state.value}
								/>
							)}
						</form.Subscribe>
						<FieldError errors={field.state.meta.errors} />
					</>
				)}
			</form.Field>
		</form>
	);
}

function FieldError(props: { readonly errors: ReadonlyArray<unknown> }) {
	const first = props.errors.find(Predicate.isString);
	return first === undefined ? null : (
		<p className="text-sm text-destructive">{first}</p>
	);
}
