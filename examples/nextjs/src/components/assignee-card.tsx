"use client";

import { AssigneeCardView } from "@examples/kit/components/user";
import { type Handle, useAtomResult } from "raf-effect-atom";

import { useIssueBoundary } from "~/boundaries.tsx";
import { assignee } from "~/issues.ts";

/** `GetIssueAssignee` loads beside the issue, by the issue's id. */
export function AssigneeCard(props: {
	readonly assignee: Handle<typeof assignee>;
}) {
	const result = useAtomResult(useIssueBoundary(assignee), props.assignee);
	return <AssigneeCardView user={result.value} />;
}
