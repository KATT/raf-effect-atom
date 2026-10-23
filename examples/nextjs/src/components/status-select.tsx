"use client";

import type { IssueId, IssueStatus } from "@examples/contract";
import { StatusMenu } from "@examples/kit/components/status-menu";
import { warnMockDbWrite } from "@examples/kit/lib/mock-db-toast";
import { useAtomSet } from "@effect/atom-react";
import { Exit } from "effect";
import { useState } from "react";
import { toast } from "sonner";

import { refreshIssues, setStatus } from "~/issues.ts";

/**
 * The status menu, saving with `SetStatus`. Every issue query refreshes after
 * it saves, so the menu shows the saved status once it's back.
 */
export function StatusSelect(props: {
	readonly align?: "start" | "end";
	readonly issueId: IssueId;
	readonly status: IssueStatus;
}) {
	const save = useAtomSet(setStatus, { mode: "promiseExit" });
	const [pending, setPending] = useState<IssueStatus | undefined>(undefined);
	return (
		<StatusMenu
			align={props.align ?? "end"}
			isPending={pending !== undefined}
			onSelect={async (status) => {
				if (status === props.status) {
					return;
				}
				setPending(status);
				warnMockDbWrite();
				const exit = await save({
					...refreshIssues,
					payload: { id: props.issueId, status },
				});
				setPending(undefined);
				if (Exit.isFailure(exit)) {
					toast.error("Couldn't change the status");
				}
			}}
			status={pending ?? props.status}
		/>
	);
}
