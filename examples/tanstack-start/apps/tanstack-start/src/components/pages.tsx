import type { IssueId, IssueListInput } from "@examples/contract";
import { CommentsSkeleton } from "@examples/kit/components/comments";
import { IssueListSkeleton } from "@examples/kit/components/issue-list";
import { IssueBodySkeleton } from "@examples/kit/components/issue-page";
import { AssigneeCardSkeleton } from "@examples/kit/components/user";
import type { LoaderVerb } from "@examples/kit/lib/loader-verb";
import { Skeleton } from "@examples/ui/components/skeleton";
import type { Handle } from "raf-effect-atom";
import { Suspense } from "react";

import { IssueBoundary } from "~/boundaries.tsx";
import { AssigneeCard } from "~/components/assignee-card.tsx";
import { Comments } from "~/components/comments.tsx";
import { IssueDetail } from "~/components/issue-detail.tsx";
import { IssueList } from "~/components/issue-list.tsx";
import { StatusFilter } from "~/components/status-filter.tsx";
import type {
	assignee,
	commentPage,
	issue,
	issueCounts,
	issuePage,
} from "~/issues.ts";

/** The handles a list route's loader returns, one per atom the page reads. */
export interface IssuesHandles {
	readonly counts: Handle<typeof issueCounts>;
	readonly page: Handle<typeof issuePage>;
}

/** The handles an issue route's loader returns, one per atom the page reads. */
export interface IssueHandles {
	readonly assignee: Handle<typeof assignee>;
	readonly comments: Handle<typeof commentPage>;
	readonly issue: Handle<typeof issue>;
}

/**
 * The list page, the same under every verb: each part suspends on the
 * handle of its own atom, which the route's loader started.
 */
export function IssuesPage(props: {
	readonly handles: IssuesHandles;
	readonly input: IssueListInput;
	readonly verb: LoaderVerb;
}) {
	return (
		<div className="grid gap-6 md:grid-cols-[180px_1fr] md:gap-8">
			<Suspense fallback={<Skeleton className="h-20 md:h-48" />}>
				<StatusFilter
					counts={props.handles.counts}
					current={props.input}
					verb={props.verb}
				/>
			</Suspense>
			<Suspense fallback={<IssueListSkeleton />}>
				<IssueList page={props.handles.page} verb={props.verb} />
			</Suspense>
		</div>
	);
}

/** An issue's page, the same under every verb. */
export function IssuePage(props: {
	readonly handles: IssueHandles;
	readonly issueId: IssueId;
}) {
	return (
		<IssueBoundary key={props.issueId}>
			<div className="grid gap-8 md:grid-cols-[1fr_240px]">
				<div className="grid content-start gap-8">
					<Suspense fallback={<IssueBodySkeleton id={props.issueId} />}>
						<IssueDetail issue={props.handles.issue} />
					</Suspense>
					<Suspense fallback={<CommentsSkeleton />}>
						<Comments issueId={props.issueId} page={props.handles.comments} />
					</Suspense>
				</div>
				<Suspense fallback={<AssigneeCardSkeleton />}>
					<AssigneeCard assignee={props.handles.assignee} />
				</Suspense>
			</div>
		</IssueBoundary>
	);
}
