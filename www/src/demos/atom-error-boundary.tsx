import { Button } from "@examples/ui/components/button";
import { Skeleton } from "@examples/ui/components/skeleton";
import {
	IssueId,
	type IssueNotFound,
	type Unauthorized,
} from "@examples/contract";
import { useAtomSet, useAtomSuspense, useAtomValue } from "@effect/atom-react";
import { AtomErrorBoundary, type CatchTagProps } from "effect-atom-boundary";
import { Atom } from "effect/reactivity";
import { Suspense } from "react";

import { AppBoundary, AppErrorBoundary } from "~/demo-kit/app-boundary.tsx";
import { BoundaryChain } from "~/demo-kit/boundary-chain.tsx";
import { ErrorNotice, IssueFailureButtons } from "~/demo-kit/controls.tsx";
import { defineDemo } from "~/demo-kit/define.ts";

import { issue } from "./issue-atoms.ts";

/** Issue 404 isn't in the db, so it fails with IssueNotFound. */
const ids = [1, 2, 3, 404].map((id) => IssueId.make(id));

function IssueTitle(props: { readonly id: IssueId }) {
	// Suspends while loading, throws every typed failure to the boundary.
	const result = useAtomSuspense(AtomErrorBoundary.claim(issue(props.id)), {
		suspendOnWaiting: true,
	});
	return (
		<div className="grid gap-1">
			<p className="font-mono text-xs text-muted-foreground">#{props.id}</p>
			<h3 className="text-lg font-semibold">{result.value.title}</h3>
		</div>
	);
}

function NotFound(props: CatchTagProps<IssueNotFound>) {
	return (
		<ErrorNotice
			action={
				<Button onClick={props.reset} size="xs" variant="outline">
					Try again
				</Button>
			}
			caughtBy="<AtomErrorBoundary>"
			type="IssueNotFound"
		>
			There’s no issue #{props.error.id}.
		</ErrorNotice>
	);
}

function SignedOut(props: CatchTagProps<Unauthorized>) {
	return (
		<ErrorNotice
			action={
				<Button onClick={props.reset} size="xs" variant="outline">
					Sign in again
				</Button>
			}
			caughtBy="<AtomErrorBoundary>"
			type="Unauthorized"
		>
			Your session expired.
		</ErrorNotice>
	);
}

function IssuePanel(props: { readonly id: IssueId }) {
	return (
		<AtomErrorBoundary
			atom={issue(props.id)}
			// claim throws every tag the atom fails with, and RpcClientError, with
			// no handler here, goes on to <AppBoundary>.
			catchTags={{
				IssueNotFound: NotFound,
				Unauthorized: SignedOut,
			}}
		>
			<Suspense fallback={<Skeleton className="h-12 w-full" />}>
				<IssueTitle id={props.id} />
			</Suspense>
		</AtomErrorBoundary>
	);
}

/** The issue the demo shows, kept across the inline and expanded views. */
const selectedAtom = Atom.make(ids[0] ?? IssueId.make(1)).pipe(
	Atom.keepAlive,
	Atom.withLabel("demo-kit:atom-error-boundary-issue"),
);

/** Queues a failure for the next request; `IssueNotFound` names the open issue. */
function Controls() {
	return <IssueFailureButtons issueId={useAtomValue(selectedAtom)} />;
}

function AtomErrorBoundaryDemo() {
	const id = useAtomValue(selectedAtom);
	const setId = useAtomSet(selectedAtom);
	return (
		<div className="grid gap-4">
			<div className="flex flex-wrap gap-1.5">
				{ids.map((each) => (
					<Button
						aria-pressed={each === id}
						key={each}
						onClick={() => {
							setId(each);
						}}
						size="xs"
						variant={each === id ? "secondary" : "ghost"}
					>
						Issue #{each}
					</Button>
				))}
			</div>
			<AppErrorBoundary>
				<AppBoundary>
					<IssuePanel id={id} />
				</AppBoundary>
			</AppErrorBoundary>
			<BoundaryChain
				atom={`GetIssue:${id}`}
				levels={[
					{
						claims: ["IssueNotFound", "Unauthorized"],
						name: "<AtomErrorBoundary>",
					},
					{ claims: ["RpcClientError"], name: "<AppBoundary>" },
				]}
				reader="<IssueTitle>"
			/>
		</div>
	);
}

export default defineDemo({
	Component: AtomErrorBoundaryDemo,
	Controls,
	hint: "Open issue #404, then queue a failure and press Try again. IssueNotFound and Unauthorized have a handler here, and RpcClientError, a request that never reached the server, goes on to <AppBoundary>. A Crash isn’t a typed error, so it reaches the app’s error boundary as unknown.",
	title: "AtomErrorBoundary",
});
