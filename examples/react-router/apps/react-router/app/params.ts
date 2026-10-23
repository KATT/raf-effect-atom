import { IssueId, IssueListInput } from "@examples/contract";
import { Option, Schema } from "effect";
import { data } from "react-router";

const decodeIssueId = Schema.decodeUnknownOption(
	Schema.NumberFromString.pipe(Schema.decodeTo(IssueId)),
);
const decodeListInput = Schema.decodeUnknownOption(IssueListInput);

/** Thrown from a loader, it renders the not-found page with a 404. */
const notFound = () => data(null, { status: 404 });

/** `:issueId` as an `IssueId`; anything else is not found. */
export const parseIssueId = (raw: string) =>
	Option.getOrThrowWith(decodeIssueId(raw), notFound);

/** The list's status and sort from the URL's search; a missing one is the default. */
export const parseListInput = (request: Request) =>
	Option.getOrThrowWith(
		decodeListInput(Object.fromEntries(new URL(request.url).searchParams)),
		notFound,
	);
