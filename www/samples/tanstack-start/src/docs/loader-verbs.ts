import type { IssueId } from "@examples/contract";
import { Effect } from "effect";
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
if (AsyncResult.isFailure(result)) {
	// The typed failure is in the result; the loader decides what to do.
}
// #endregion match

// #region effect
const program = Effect.gen(function* () {
	yield* Loader.prefetch(assignee(id));
	return yield* Loader.ensure(issue(id));
});
// #endregion effect
