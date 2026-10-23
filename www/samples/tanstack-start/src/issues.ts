import { IssueId } from "@examples/contract";
import { Schema } from "effect";

import { IssuesClient } from "./issues-client.ts";

/** The `/issues/$id` route's params: `$id` is an `IssueId` in the URL. */
export const IssueParams = Schema.Struct({
	id: Schema.NumberFromString.pipe(Schema.decodeTo(IssueId)),
});

// #region atoms
// A serialization key lets the server send the result to the browser.
export const issue = (id: IssueId) =>
	//          ^?
	IssuesClient.query("GetIssue", { id }, { serializationKey: `${id}` });

export const assignee = (issueId: IssueId) =>
	IssuesClient.query(
		"GetIssueAssignee",
		{ issueId },
		{ serializationKey: `${issueId}` },
	);
// #endregion atoms

export const searchIssues = (query: string) =>
	IssuesClient.query("SearchIssues", { query });
