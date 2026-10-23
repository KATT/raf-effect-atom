import { type IssueId } from "@examples/contract";
import { Atom } from "effect/reactivity";

import { IssuesClient } from "~/demo-kit/client.ts";

function makeIssue(id: IssueId) {
	return IssuesClient.query("GetIssue", { id }, { serializationKey: `${id}` });
}

/** An issue by id, as `AtomRpc:GetIssue:<id>`. */
export const issue = Atom.family(makeIssue);
