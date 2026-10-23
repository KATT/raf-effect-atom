import type { IssueId } from "@examples/contract";
import { useAtomSuspense } from "@effect/atom-react";
import { AtomErrorBoundary } from "effect-atom-boundary";
import { Suspense } from "react";

import { issue } from "~/issues.ts";

declare const id: IssueId;

// #region boundary
export function IssuePanel(props: { id: IssueId }) {
	return (
		<AtomErrorBoundary
			atom={issue(props.id)}
			catchTags={{
				IssueNotFound: ({ error, reset }) => (
					<p>
						There's no issue #{error.id}.{" "}
						<button onClick={reset}>Try again</button>
					</p>
				),
			}}
		>
			<Suspense fallback={<p>Loading…</p>}>
				<IssueTitle id={props.id} />
			</Suspense>
		</AtomErrorBoundary>
	);
}

function IssueTitle(props: { id: IssueId }) {
	// Suspends while loading, throws a typed failure to the boundaries above.
	const result = useAtomSuspense(AtomErrorBoundary.claim(issue(props.id)), {
		suspendOnWaiting: true,
	});
	return <h1>{result.value.title}</h1>;
}
// #endregion boundary

// #region handler-types
<AtomErrorBoundary
	atom={issue(id)}
	catchTags={{
		IssueNotFound: ({ error }) => {
			error;
			// ^?
			return <p>There's no issue #{error.id}.</p>;
		},
		Unauthorized: ({ error }) => {
			error;
			// ^?
			return <p>Sign in to see this issue.</p>;
		},
	}}
/>;
// #endregion handler-types

// #region misspelled
<AtomErrorBoundary
	atom={issue(id)}
	catchTags={{
		// @ts-expect-error -- 2561: the atom can't fail with IssueNotFund
		IssueNotFund: () => <p>Not found</p>,
	}}
/>;
// #endregion misspelled
