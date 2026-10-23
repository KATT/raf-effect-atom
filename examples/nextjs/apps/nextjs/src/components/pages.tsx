"use client";

import type { IssueId, IssueListInput } from "@examples/contract";
import { CommentsSkeleton } from "@examples/kit/components/comments";
import { IssueListSkeleton } from "@examples/kit/components/issue-list";
import { IssueBodySkeleton } from "@examples/kit/components/issue-page";
import { AssigneeCardSkeleton } from "@examples/kit/components/user";
import type { LoaderVerb } from "@examples/kit/lib/loader-verb";
import { Skeleton } from "@examples/ui/components/skeleton";
import { Suspense } from "react";

import { IssueBoundary } from "~/boundaries.tsx";
import { AssigneeCard } from "~/components/assignee-card.tsx";
import { Comments } from "~/components/comments.tsx";
import { IssueDetail } from "~/components/issue-detail.tsx";
import { IssueList } from "~/components/issue-list.tsx";
import { StatusFilter } from "~/components/status-filter.tsx";

/**
 * The list page, the same under every verb: each part suspends on its own
 * atom, which the page's server component started.
 */
export function IssuesPage(props: {
	readonly input: IssueListInput;
	readonly verb: LoaderVerb;
}) {
	return (
		<div className="grid gap-6 md:grid-cols-[180px_1fr] md:gap-8">
			<Suspense fallback={<Skeleton className="h-20 md:h-48" />}>
				<StatusFilter current={props.input} verb={props.verb} />
			</Suspense>
			<Suspense fallback={<IssueListSkeleton />}>
				<IssueList input={props.input} verb={props.verb} />
			</Suspense>
		</div>
	);
}

/** An issue's page, the same under every verb. */
export function IssuePage(props: { readonly issueId: IssueId }) {
	return (
		<IssueBoundary key={props.issueId}>
			<div className="grid gap-8 md:grid-cols-[1fr_240px]">
				<div className="grid content-start gap-8">
					<Suspense fallback={<IssueBodySkeleton id={props.issueId} />}>
						<IssueDetail id={props.issueId} />
					</Suspense>
					<Suspense fallback={<CommentsSkeleton />}>
						<Comments issueId={props.issueId} />
					</Suspense>
				</div>
				<Suspense fallback={<AssigneeCardSkeleton />}>
					<AssigneeCard issueId={props.issueId} />
				</Suspense>
			</div>
		</IssueBoundary>
	);
}
