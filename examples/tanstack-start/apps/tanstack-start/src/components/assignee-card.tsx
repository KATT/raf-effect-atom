import type { IssueId } from "@examples/contract";
import { AssigneeCardView } from "@examples/kit/components/user";
import { useAtomResult } from "raf-effect-atom";

import { useIssueBoundary } from "~/boundaries.tsx";
import { assignee } from "~/issues.ts";

/** `GetIssueAssignee` loads beside the issue, by the issue's id. */
export function AssigneeCard(props: { readonly issueId: IssueId }) {
	const result = useAtomResult(
		useIssueBoundary().wrap(assignee(props.issueId)),
	);
	return <AssigneeCardView user={result.value} />;
}
