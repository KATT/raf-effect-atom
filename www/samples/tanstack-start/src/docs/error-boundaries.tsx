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
			// claim throws every tag the atom fails with, and a tag with no
			// handler here goes to the boundaries above: name each one.
			catchTags={{
				IssueNotFound: ({ error }) => <p>There's no issue #{error.id}.</p>,
				RpcClientError: ({ reset }) => (
					<p>
						Couldn't reach the server.{" "}
						<button onClick={reset}>Try again</button>
					</p>
				),
				Unauthorized: () => <p>Sign in to see this issue.</p>,
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
	const claimed = AtomErrorBoundary.claim(issue(props.id));
	const result = useAtomSuspense(claimed, { suspendOnWaiting: true });
	//    ^?
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
