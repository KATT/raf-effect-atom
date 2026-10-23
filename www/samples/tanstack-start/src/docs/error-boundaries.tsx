import { Match, Option } from "effect";
import { createErrorBoundary } from "effect-atom-boundary";
import { AsyncResult } from "effect/reactivity";
import { type Handle, useAtomResult } from "raf-effect-atom";
import { Suspense } from "react";

import { issue } from "~/issues.ts";

// #region issue
export const [AppBoundary] = createErrorBoundary({
	name: "App",
	errors: issue,
	catchTags: {
		RpcClientError: ({ reset }) => (
			<p>
				Can't reach the server. <button onClick={reset}>Try again</button>
			</p>
		),
	},
});

export const [IssueBoundary, useIssueBoundary] = createErrorBoundary({
	name: "Issue",
	errors: issue,
	parent: AppBoundary,
	catchTags: {
		IssueNotFound: ({ error, reset }) => (
			<p>
				There's no issue #{error.id}. <button onClick={reset}>Try again</button>
			</p>
		),
	},
});

export function IssuePanel(props: { issue: Handle<typeof issue> }) {
	return (
		<AppBoundary>
			<IssueBoundary>
				<Suspense fallback={<p>Loading…</p>}>
					<IssueTitle issue={props.issue} />
				</Suspense>
			</IssueBoundary>
		</AppBoundary>
	);
}

function IssueTitle(props: { issue: Handle<typeof issue> }) {
	const result = useAtomResult(useIssueBoundary().wrap(issue), props.issue);
	if (AsyncResult.isSuccess(result)) {
		return <h1>{result.value.title}</h1>;
	}
	const error = Option.getOrThrow(AsyncResult.error(result));
	//    ^?
	return Match.valueTags(error, {
		Unauthorized: () => <p>Sign in to see this issue.</p>,
	});
}
// #endregion issue

// #region handler-types
export const [IssueAccessBoundary] = createErrorBoundary({
	name: "IssueAccess",
	errors: issue,
	catchTags: {
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
	},
});
// #endregion handler-types

// #region misspelled
export const [NotFoundBoundary] = createErrorBoundary({
	name: "NotFound",
	errors: issue,
	catchTags: {
		// @ts-expect-error -- 2561: the atom can't fail with IssueNotFund
		IssueNotFund: () => <p>Not found</p>,
	},
});
// #endregion misspelled
