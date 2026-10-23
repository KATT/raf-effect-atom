import type { IssueId, UserId } from "@examples/contract";
import {
	createRootRouteWithContext,
	createRoute,
} from "@tanstack/react-router";
import { Effect } from "effect";
import { AsyncResult, Atom } from "effect/reactivity";
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
// Only the browser can ask: the atom runs there, so it needs no
// serialization key.
const notifications = Atom.make(
	Effect.promise(() => navigator.permissions.query({ name: "notifications" })),
).pipe(Atom.map(AsyncResult.map((status) => status.state)));

const appRoot = createRootRouteWithContext<{
	readonly atoms: Loader.Loader;
}>()();

const settingsRoute = createRoute({
	getParentRoute: () => appRoot,
	path: "/settings",
	loader: ({ context }) => ({
		// The server renders the page without it; the browser's read starts it.
		notifications: context.atoms.prefetchInBrowser(notifications),
	}),
});

// The page renders on the server; the boundary waits for the browser.
function SettingsPage(props: { notifications: Handle<typeof notifications> }) {
	return (
		<Suspense fallback={<p>Checking notifications…</p>}>
			<NotificationSetting notifications={props.notifications} />
		</Suspense>
	);
}

function NotificationSetting(props: {
	notifications: Handle<typeof notifications>;
}) {
	const result = useAtomResult(notifications, props.notifications);
	return <p>Notifications: {result.value}</p>;
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
