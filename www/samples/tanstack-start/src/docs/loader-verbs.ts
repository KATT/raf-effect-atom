import type { IssueId } from "@examples/contract";
import { notFound } from "@tanstack/react-router";
import { Effect, Match, Option } from "effect";
import { AsyncResult } from "effect/reactivity";
import { Loader } from "raf-effect-atom";

import { assignee, issue } from "~/issues.ts";

declare const atoms: Loader.Loader;
declare const id: IssueId;

// #region verbs
// Starts the atom and returns at once.
atoms.prefetch(assignee(id));

// Waits for a result, unless the atom already has one.
const result = await atoms.ensure(issue(id));
//    ^?

// Refreshes the atom if it has a result, and waits for the new one.
await atoms.fetch(issue(id));
// #endregion verbs

// #region match
const error = AsyncResult.error(result);
//    ^?
if (Option.isSome(error)) {
	// One case per tag the atom can fail with; a missing one doesn't compile.
	Match.valueTags(error.value, {
		IssueNotFound: () => {
			throw notFound();
		},
		// Left in the result: <AuthBoundary> catches it when the page reads
		// the atom.
		Unauthorized: () => undefined,
		// Left in the result: the page renders it.
		RpcClientError: () => undefined,
	});
}
// #endregion match

// #region effect
const program = Effect.gen(function* () {
	yield* Loader.prefetch(assignee(id));
	return yield* Loader.ensure(issue(id));
});
// #endregion effect
