import { IssueId } from "@examples/contract";
import { notFound } from "@tanstack/react-router";
import { Option, Schema } from "effect";

/** The issue routes' params: `$issueId` is an `IssueId` in the URL. */
const IssueParams = Schema.Struct({
	issueId: Schema.NumberFromString.pipe(Schema.decodeTo(IssueId)),
});

const decodeIssueParams = Schema.decodeOption(IssueParams);

/** A `$issueId` that isn't an `IssueId` is the router's not-found. */
export const issueIdParams = {
	parse: (raw: typeof IssueParams.Encoded) =>
		Option.getOrThrowWith(decodeIssueParams(raw), notFound),
	stringify: Schema.encodeSync(IssueParams),
};
