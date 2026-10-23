import type { IssueId, UserId } from "@examples/contract";
import { Effect } from "effect";
import { AsyncResult } from "effect/reactivity";
import {
	type Handle,
	Loader,
	useAtomResult,
	useWaterfall,
} from "raf-effect-atom";
import { startTransition, Suspense, use, useEffect, useState } from "react";
import { RegistryContext, useAtomSuspense } from "@effect/atom-react";

import { useAuthBoundary } from "~/boundaries.tsx";
import { assignee, issue, searchIssues } from "~/issues.ts";

declare const atoms: Loader.Loader;
declare const id: IssueId;
/** A user by id, from an API the app can't reshape. */
declare const user: (id: UserId) => ReturnType<typeof assignee>;
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

// #region dependent
// The input comes from the issue: the user starts a round trip later.
const parent = await atoms.ensure(issue, id);
const found = Loader.result(parent);
const userHandle = AsyncResult.isSuccess(found)
	? atoms.prefetch(user, found.value.assigneeId)
	: undefined;
// #endregion dependent

// #region event-handler
// Each keystroke doesn't belong in the URL, so a debounce starts the search
// once the text stops changing, then renders its handle in a transition,
// which keeps the previous results on screen until the new ones are in.
function IssueSearch() {
	const registry = use(RegistryContext);
	const [text, setText] = useState("");
	const [search, setSearch] = useState<Handle<typeof searchIssues>>();
	useEffect(() => {
		const timeout = setTimeout(() => {
			startTransition(() => {
				setSearch(
					text === ""
						? undefined
						: Loader.make(registry).prefetch(searchIssues, text),
				);
			});
		}, 300);
		return () => clearTimeout(timeout);
	}, [registry, text]);
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
		//    ^?
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
