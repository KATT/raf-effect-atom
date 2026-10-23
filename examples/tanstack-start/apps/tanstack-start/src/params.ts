import { IssueId } from "@examples/contract";
import { notFound } from "@tanstack/react-router";
import { Option, Schema } from "effect";

const decodeIssueId = Schema.decodeUnknownOption(
	Schema.NumberFromString.pipe(Schema.decodeTo(IssueId)),
);

/** `$issueId` as an `IssueId`; anything else is the router's not-found. */
export const issueIdParams = {
	parse: (raw: { readonly issueId: string }) => ({
		issueId: Option.getOrThrowWith(decodeIssueId(raw.issueId), () =>
			notFound(),
		),
	}),
	stringify: (params: { readonly issueId: IssueId }) => ({
		issueId: String(params.issueId),
	}),
};
