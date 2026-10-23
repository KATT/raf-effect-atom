"use client";

import type { IssueListInput } from "@examples/contract";
import {
	issueStatuses,
	statusLabel,
} from "@examples/kit/components/status-badge";
import type { LoaderVerb } from "@examples/kit/lib/loader-verb";
import { cn } from "@examples/ui/lib/utils";
import { AsyncResult } from "effect/reactivity";
import { useAtomResult } from "raf-effect-atom";

import { useAuthBoundary } from "~/boundaries.tsx";
import { AppLink } from "~/components/settings.tsx";
import { LoadFailed } from "~/components/load-failed.tsx";
import { issueCounts } from "~/issues.ts";

const sorts = ["newest", "oldest"] as const;

export function StatusFilter(props: {
	readonly current: IssueListInput;
	readonly verb: LoaderVerb;
}) {
	const result = useAtomResult(useAuthBoundary().wrap(issueCounts));
	if (!AsyncResult.isSuccess(result)) {
		return <LoadFailed result={result} />;
	}
	const counts = result.value;
	const current = props.current;

	return (
		<aside className="grid content-start gap-3 md:gap-6">
			<nav className="flex flex-wrap gap-1 md:grid">
				{(["all", ...issueStatuses] as const).map((status) => (
					<AppLink
						className={cn(
							"flex justify-between gap-2 rounded-md px-3 py-1.5 text-sm hover:bg-muted",
							current.status === status && "bg-muted font-medium",
						)}
						href={{
							pathname: `/${props.verb}/issues`,
							query: { ...current, status },
						}}
						key={status}
					>
						{statusLabel(status)}
						<span className="text-muted-foreground">{counts[status]}</span>
					</AppLink>
				))}
			</nav>
			<nav className="flex flex-wrap items-center gap-1 md:grid">
				<span className="px-3 text-xs font-medium text-muted-foreground uppercase">
					Sort
				</span>
				{sorts.map((sort) => (
					<AppLink
						className={cn(
							"rounded-md px-3 py-1.5 text-sm capitalize hover:bg-muted",
							current.sort === sort && "bg-muted font-medium",
						)}
						href={{
							pathname: `/${props.verb}/issues`,
							query: { ...current, sort },
						}}
						key={sort}
					>
						{sort}
					</AppLink>
				))}
			</nav>
		</aside>
	);
}
