import type { IssueId, UserId } from "@examples/contract";
import {
	createRootRouteWithContext,
	createRoute,
} from "@tanstack/react-router";
import { Effect } from "effect";
import { AsyncResult } from "effect/reactivity";
import {
	type Handle,
	Loader,
	useAtomResult,
	useWaterfall,
} from "raf-effect-atom";
import { Suspense } from "react";
import { useAtomSuspense } from "@effect/atom-react";

import { useAuthBoundary, useIssueBoundary } from "~/boundaries.tsx";
import { assignee, issue } from "~/issues.ts";

declare const atoms: Loader.Loader;
declare const id: IssueId;
/** What a one-time token grants. It only runs in the browser. */
declare const connection: (token: string) => ReturnType<typeof issue>;
/** A user by id, from an API the app can't reshape. */
declare const user: (id: UserId) => ReturnType<typeof assignee>;

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

// #region browser-only
// The router's context: getRouter reads `entry` from the URL fragment in the
// browser, and erases it there. On the server it's undefined.
const appRoot = createRootRouteWithContext<{
	readonly atoms: Loader.Loader;
	readonly entry: { readonly token: string } | undefined;
}>()();

const connectRoute = createRoute({
	getParentRoute: () => appRoot,
	path: "/connect",
	// The server renders the pending component; the loader and the page run
	// in the browser, where the token is.
	ssr: false,
	pendingComponent: () => <p>Opening the connection…</p>,
	loader: ({ context }) => ({
		connection:
			context.entry === undefined
				? undefined
				: context.atoms.prefetch(connection, context.entry.token),
	}),
});

// The page passes the loader's handle down, as for any other route.
function Connection(props: { connection: Handle<typeof connection> }) {
	const result = useAtomResult(
		useAuthBoundary().wrap(connection),
		props.connection,
	);
	return AsyncResult.isSuccess(result) ? (
		<h1>{result.value.title}</h1>
	) : (
		<p>This link has expired.</p>
	);
}
// #endregion browser-only

// #region use-waterfall
// The user's id is in the issue, so only a render that has the issue knows it.
function IssueAssignee(props: { issue: Handle<typeof issue> }) {
	const result = useAtomResult(useIssueBoundary().wrap(issue), props.issue);
	return (
		<Suspense fallback={<p>Loading the user…</p>}>
			<UserName id={result.value.assigneeId} />
		</Suspense>
	);
}

function UserName(props: { id: UserId }) {
	// The issue, auth and app boundaries claim IssueNotFound, Unauthorized and
	// RpcClientError.
	const result = useAtomResult(
		//    ^?
		useIssueBoundary().wrap(user),
		useWaterfall(user, props.id),
	);
	return <p>{result.value.name}</p>;
}
// #endregion use-waterfall
