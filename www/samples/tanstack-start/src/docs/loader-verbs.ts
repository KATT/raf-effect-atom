import type { IssueId } from "@examples/contract";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { Effect, Match, Option, Schema } from "effect";
import { AsyncResult } from "effect/reactivity";
import { Loader } from "raf-effect-atom";

import { assignee, issue, IssueParams } from "~/issues.ts";

declare const atoms: Loader.Loader;
declare const id: IssueId;

// #region verbs
// Starts the atom and returns its handle at once.
const assigneeHandle = atoms.prefetch(assignee, id);
//    ^?

// Waits for a result, unless the atom already has one.
const issueHandle = await atoms.ensure(issue, id);
//    ^?

// Refreshes the atom if it has a result, and waits for the new one.
await atoms.fetch(issue, id);
// #endregion verbs

// #region match
// The result ensure or fetch waited for, in the loader that called it.
const result = Loader.result(issueHandle);
const error = AsyncResult.error(result);
//    ^?
if (Option.isSome(error)) {
	// One case per tag the atom can fail with; a missing one doesn't compile.
	Match.valueTags(error.value, {
		IssueNotFound: () => {
			throw notFound();
		},
		// Left in the result: <AuthBoundary> and <AppBoundary> catch them
		// when the page reads the atom.
		Unauthorized: () => undefined,
		RpcClientError: () => undefined,
	});
}
// #endregion match

// #region effect
const program = Effect.gen(function* () {
	const assigneeHandle = yield* Loader.prefetch(assignee, id);
	const issueHandle = yield* Loader.ensure(issue, id);
	return { assignee: assigneeHandle, issue: issueHandle };
});

// Runs it on the registry the Promise verbs use.
const handles = await atoms.run(program);
//    ^?
// #endregion effect

// #region signal
export const Route = createFileRoute("/issues/$id")({
	params: {
		parse: (params) => Schema.decodeUnknownSync(IssueParams)(params),
		stringify: Schema.encodeSync(IssueParams),
	},
	loader: async ({ abortController, context, params }) => ({
		// Stops waiting when another navigation supersedes this one.
		issue: await context.atoms.run(Loader.ensure(issue, params.id), {
			signal: abortController.signal,
		}),
	}),
});
// #endregion signal
