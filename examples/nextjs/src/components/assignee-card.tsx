"use client";

import type { IssueId } from "@examples/contract";
import { AssigneeCardView } from "@examples/kit/components/user";
import { AsyncResult } from "effect/reactivity";
import { useAtomResult } from "raf-effect-atom";

import { useIssueBoundary } from "~/boundaries.tsx";
import { LoadFailed } from "~/components/load-failed.tsx";
import { assignee } from "~/issues.ts";

/** `GetIssueAssignee` loads beside the issue, by the issue's id. */
export function AssigneeCard(props: { readonly issueId: IssueId }) {
	const result = useAtomResult(
		useIssueBoundary().wrap(assignee(props.issueId)),
	);
	return AsyncResult.isSuccess(result) ? (
		<AssigneeCardView user={result.value} />
	) : (
		<LoadFailed result={result} />
	);
}
