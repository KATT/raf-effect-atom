import { Match, Option } from "effect";
import { createErrorBoundary } from "effect-atom-boundary";
import { AsyncResult } from "effect/reactivity";
import { type Handle, useAtomResult } from "raf-effect-atom";

import { AppBoundary, useAppBoundary } from "~/boundaries.tsx";
import { IssuesClient } from "~/issues-client.ts";
import { issue } from "~/issues.ts";

declare const issueHandle: Handle<typeof issue>;

// #region narrowed
function IssueTitle(props: { issue: Handle<typeof issue> }) {
	const result = useAtomResult(useAppBoundary().wrap(issue), props.issue);
	if (AsyncResult.isSuccess(result)) {
		return <h1>{result.value.title}</h1>;
	}
	// useAtomResult throws defects, so a failure it returns has a typed error.
	const error = Option.getOrThrow(AsyncResult.error(result));
	//    ^?
	return Match.valueTags(error, {
		IssueNotFound: (notFound) => <p>There's no issue #{notFound.id}.</p>,
		Unauthorized: () => <p>Sign in to see this issue.</p>,
	});
}
// #endregion narrowed

// #region misspelled
createErrorBoundary({
	name: "App",
	errors: IssuesClient,
	catchTags: {
		// @ts-expect-error -- 2561: no procedure fails with RpcClientEror
		RpcClientEror: () => <p>Can't reach the server.</p>,
	},
});
// #endregion misspelled

// #region mounted
function App() {
	return (
		<AppBoundary>
			<IssueTitle issue={issueHandle} />
		</AppBoundary>
	);
}
// #endregion mounted
