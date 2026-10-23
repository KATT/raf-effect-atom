import type { IssueId } from "@examples/contract";
import { Effect } from "effect";
import {
	type Handle,
	Loader,
	useAtomResult,
	useWaterfall,
} from "raf-effect-atom";
import { startTransition, Suspense, use, useRef, useState } from "react";
import { RegistryContext, useAtomSuspense } from "@effect/atom-react";

import { useAuthBoundary } from "~/boundaries.tsx";
import { assignee, issue, searchIssues } from "~/issues.ts";

declare const atoms: Loader.Loader;
declare const id: IssueId;
/** `value`, once it has stopped changing for `ms`. */
declare function useDebouncedValue<A>(value: A, ms: number): A;

// #region fetch-on-render
// Each component builds its atom from an id with Effect Atom's own hook, so
// each read starts its own request.
function IssuePage(props: { issueId: IssueId }) {
	// Starts GetIssue, and suspends until it settles.
	const result = useAtomSuspense(issue(props.issueId));
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
	const result = useAtomSuspense(assignee(props.issueId));
	return <p>{result.value.name}</p>;
}
// #endregion fetch-on-render

// #region await-first
// The assignee starts only once the issue is in: two round trips.
const issueFirst = await atoms.ensure(issue, id);
const assigneeLater = atoms.prefetch(assignee, id);
// #endregion await-first

// #region start-first
// Both start now; the loader waits only for the issue.
const assigneeHandle = atoms.prefetch(assignee, id);
const issueHandle = await atoms.ensure(issue, id);
// #endregion start-first

// #region await-both
// Both start now, and the loader waits for both.
const [issueLoaded, assigneeLoaded] = await Promise.all([
	atoms.ensure(issue, id),
	atoms.ensure(assignee, id),
]);
// #endregion await-both

// #region effect-all
// Effect.all runs its effects one after another unless it's given a
// concurrency: without it, the assignee would start after the issue settled.
const both = Effect.all(
	//    ^?
	[Loader.ensure(issue, id), Loader.ensure(assignee, id)],
	{ concurrency: "unbounded" },
);
// #endregion effect-all

// #region event-handler
// Each keystroke doesn't belong in the URL, so the debounced handler starts
// the search, then renders its handle in a transition, which keeps the
// previous results on screen until the new ones are in.
function IssueSearch() {
	const registry = use(RegistryContext);
	const [search, setSearch] = useState<Handle<typeof searchIssues>>();
	const timeout = useRef<ReturnType<typeof setTimeout>>(undefined);
	return (
		<search>
			<input
				aria-label="Search issues"
				onChange={(event) => {
					const next = event.target.value;
					clearTimeout(timeout.current);
					timeout.current = setTimeout(() => {
						const started =
							next === ""
								? undefined
								: Loader.make(registry).prefetch(searchIssues, next);
						startTransition(() => {
							setSearch(started);
						});
					}, 300);
				}}
				type="search"
			/>
			{search === undefined ? null : (
				<Suspense fallback={<p>Searching…</p>}>
					<SearchResults search={search} />
				</Suspense>
			)}
		</search>
	);
}

function SearchResults(props: { search: Handle<typeof searchIssues> }) {
	// The app and auth boundaries claim RpcClientError and Unauthorized.
	const result = useAtomResult(
		useAuthBoundary().wrap(searchIssues),
		props.search,
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
		useAuthBoundary().wrap(searchIssues),
		useWaterfall(searchIssues, props.query),
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
