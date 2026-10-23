"use client";

import {
	IssueListSummary,
	IssueRow,
	issueRowClassName,
	IssueRowSkeletons,
	NoIssues,
} from "@examples/kit/components/issue-list";
import { LoadMore } from "@examples/kit/components/load-more";
import type { LoaderVerb } from "@examples/kit/lib/loader-verb";
import { Card } from "@examples/ui/components/card";
import { cn } from "@examples/ui/lib/utils";
import { RegistryContext } from "@effect/atom-react";
import { type Handle, Loader, useAtomResult } from "raf-effect-atom";
import { Suspense, use, useState } from "react";

import { useAuthBoundary } from "~/boundaries.tsx";
import { AppLink } from "~/components/settings.tsx";
import { StatusSelect } from "~/components/status-select.tsx";
import { issuePage } from "~/issues.ts";

/**
 * The list, one page per atom. The page starts the first one; each page
 * renders the next one when "Load more" is pressed.
 */
export function IssueList(props: {
	readonly page: Handle<typeof issuePage>;
	readonly verb: LoaderVerb;
}) {
	return (
		<Card className="gap-0 py-0">
			<IssuePage key={props.page.key} page={props.page} verb={props.verb} />
		</Card>
	);
}

function IssuePage(props: {
	readonly page: Handle<typeof issuePage>;
	readonly verb: LoaderVerb;
}) {
	const result = useAtomResult(useAuthBoundary(issuePage), props.page);
	const [more, setMore] = useState<Handle<typeof issuePage>>();
	const registry = use(RegistryContext);
	const [input, cursor] = props.page.args;
	const page = result.value;
	const next = page.nextCursor;
	const shown = cursor + page.issues.length;
	return (
		<>
			{shown === 0 ? <NoIssues /> : null}
			<div
				className={cn(
					"divide-y border-b last:border-b-0",
					cursor > 0 && "animate-in duration-500 fade-in",
				)}
			>
				{page.issues.map((issue) => (
					<AppLink
						className={issueRowClassName}
						href={`/${props.verb}/issues/${issue.id}`}
						key={issue.id}
					>
						<IssueRow issue={issue}>
							<StatusSelect issueId={issue.id} status={issue.status} />
						</IssueRow>
					</AppLink>
				))}
			</div>
			{next === null ? null : more ? (
				<Suspense
					fallback={
						<IssueRowSkeletons
							count={Math.min(page.issues.length, page.total - shown)}
						/>
					}
				>
					<IssuePage page={more} verb={props.verb} />
				</Suspense>
			) : (
				<div className="grid gap-3 p-4">
					<IssueListSummary shown={shown} total={page.total} />
					<LoadMore
						onLoad={() => {
							// Starts the next page here, not in its reader's render.
							setMore(Loader.make(registry).prefetch(issuePage, input, next));
						}}
					/>
				</div>
			)}
			{next === null && shown > 0 ? (
				<div className="p-4">
					<IssueListSummary shown={shown} total={page.total} />
				</div>
			) : null}
		</>
	);
}
