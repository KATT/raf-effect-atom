import type { IssueId } from "@examples/contract";
import { Effect } from "effect";
import { Loader, useAtomResult, useWaterfall } from "raf-effect-atom";
import { startTransition, Suspense, use, useRef, useState } from "react";
import { RegistryContext } from "@effect/atom-react";

import { useAuthBoundary, useIssueBoundary } from "~/boundaries.tsx";
import { assignee, issue, searchIssues } from "~/issues.ts";

declare const atoms: Loader.Loader;
declare const id: IssueId;
/** `value`, once it has stopped changing for `ms`. */
declare function useDebouncedValue<A>(value: A, ms: number): A;

// #region fetch-on-render
// No loader started these atoms, so each read starts its own request.
function IssuePage(props: { issueId: IssueId }) {
	// Starts GetIssue, and suspends until it settles.
	const result = useAtomResult(useIssueBoundary().wrap(issue(props.issueId)));
	return (
		<article>
			<h1>{result.value.title}</h1>
			<Suspense fallback={<p>Loading the assignee…</p>}>
				{/* Renders, and starts GetIssueAssignee, only now. */}
				<Assignee issueId={props.issueId} />
			</Suspense>
		</article>
	);
}

function Assignee(props: { issueId: IssueId }) {
	const result = useAtomResult(
		useIssueBoundary().wrap(assignee(props.issueId)),
	);
	return <p>{result.value.name}</p>;
}
// #endregion fetch-on-render

// #region await-first
// The assignee starts only once the issue is in: two round trips.
await atoms.ensure(issue(id));
atoms.prefetch(assignee(id));
// #endregion await-first

// #region start-first
// Both start now; the loader waits only for the issue.
atoms.prefetch(assignee(id));
await atoms.ensure(issue(id));
// #endregion start-first

// #region await-both
// Both start now, and the loader waits for both.
const [issueResult, assigneeResult] = await Promise.all([
	atoms.ensure(issue(id)),
	atoms.ensure(assignee(id)),
]);
// #endregion await-both

// #region effect-all
// Effect.all runs its effects one after another unless it's given a
// concurrency: without it, the assignee would start after the issue settled.
const both = Effect.all(
	//    ^?
	[Loader.ensure(issue(id)), Loader.ensure(assignee(id))],
	{ concurrency: "unbounded" },
);
// #endregion effect-all

// #region event-handler
// Each keystroke doesn't belong in the URL, so the debounced handler starts
// the search, then renders its results in a transition, which keeps the
// previous results on screen until the new ones are in.
function IssueSearch() {
	const registry = use(RegistryContext);
	const [query, setQuery] = useState("");
	const timeout = useRef<ReturnType<typeof setTimeout>>(undefined);
	return (
		<search>
			<input
				aria-label="Search issues"
				onChange={(event) => {
					const next = event.target.value;
					clearTimeout(timeout.current);
					timeout.current = setTimeout(() => {
						Loader.make(registry).prefetch(searchIssues(next));
						startTransition(() => {
							setQuery(next);
						});
					}, 300);
				}}
				type="search"
			/>
			{query === "" ? null : (
				<Suspense fallback={<p>Searching…</p>}>
					<SearchResults query={query} />
				</Suspense>
			)}
		</search>
	);
}

function SearchResults(props: { query: string }) {
	// The app and auth boundaries claim RpcClientError and Unauthorized.
	const result = useAtomResult(
		useAuthBoundary().wrap(searchIssues(props.query)),
	);
	return (
		<ul>
			{result.value.map((found) => (
				<li key={found.id}>{found.title}</li>
			))}
		</ul>
	);
}
// #endregion event-handler

// #region use-waterfall
// The query exists only in render: it's the input's text, debounced.
function DebouncedSearch() {
	const [text, setText] = useState("");
	const query = useDebouncedValue(text, 300);
	return (
		<search>
			<input
				aria-label="Search issues"
				onChange={(event) => {
					setText(event.target.value);
				}}
				type="search"
				value={text}
			/>
			{query === "" ? null : (
				<Suspense fallback={<p>Searching…</p>}>
					<DebouncedResults query={query} />
				</Suspense>
			)}
		</search>
	);
}

function DebouncedResults(props: { query: string }) {
	const result = useAtomResult(
		useAuthBoundary().wrap(useWaterfall(searchIssues(props.query))),
	);
	return (
		<ul>
			{result.value.map((found) => (
				<li key={found.id}>{found.title}</li>
			))}
		</ul>
	);
}
// #endregion use-waterfall
