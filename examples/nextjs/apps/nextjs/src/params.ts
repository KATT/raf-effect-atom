import { IssueId, IssueListInput } from "@examples/contract";
import { Option, Schema } from "effect";
import { notFound } from "next/navigation";

const decodeIssueId = Schema.decodeUnknownOption(
	Schema.NumberFromString.pipe(Schema.decodeTo(IssueId)),
);

const decodeListInput = Schema.decodeUnknownOption(IssueListInput);

/** `[issueId]` as an `IssueId`; anything else is the not-found page. */
export async function issueIdParam(
	params: Promise<{ readonly issueId: string }>,
) {
	const raw = await params;
	return Option.getOrElse(decodeIssueId(raw.issueId), () => notFound());
}

/** The list's search params; a status or sort it doesn't know is not found. */
export async function listSearchParams(searchParams: Promise<unknown>) {
	return Option.getOrElse(decodeListInput(await searchParams), () =>
		notFound(),
	);
}
