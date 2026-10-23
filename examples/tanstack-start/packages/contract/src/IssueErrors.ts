import { Schema } from "effect";

import { IssueId } from "./Issue.ts";

export class IssueNotFound extends Schema.TaggedError<IssueNotFound>()(
	"IssueNotFound",
	{ id: IssueId },
) {}

export class EmptyTitle extends Schema.TaggedError<EmptyTitle>()(
	"EmptyTitle",
	{},
) {}

export class EmptyBody extends Schema.TaggedError<EmptyBody>()(
	"EmptyBody",
	{},
) {}

export class EmptyComment extends Schema.TaggedError<EmptyComment>()(
	"EmptyComment",
	{},
) {}
