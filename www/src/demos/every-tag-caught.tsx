import { Button } from "@examples/ui/components/button";
import { Skeleton } from "@examples/ui/components/skeleton";
import {
	IssueId,
	type IssueNotFound,
	type Unauthorized,
} from "@examples/contract";
import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { type CatchTagProps, createErrorBoundary } from "effect-atom-boundary";
import { useAtomResult } from "raf-effect-atom";
import { Atom } from "effect/reactivity";
import { Suspense } from "react";

import { AppBoundary, AppErrorBoundary } from "~/demo-kit/app-boundary.tsx";
import { BoundaryChain } from "~/demo-kit/boundary-chain.tsx";
import { IssuesClient } from "~/demo-kit/client.ts";
import { ErrorNotice, IssueFailureButtons } from "~/demo-kit/controls.tsx";
import { defineDemo } from "~/demo-kit/define.ts";

import { issue } from "./issue-atoms.ts";

/** Issue 404 isn't in the db, so it fails with IssueNotFound. */
const ids = [1, 2, 3, 404].map((id) => IssueId.make(id));

/**
 * Reads an issue under `<IssuePageBoundary>`: its `catchTags` and its
 * parent's name every tag of the atom's error, so the result is a success.
 */
function IssueTitle(props: { readonly id: IssueId }) {
	const result = useAtomResult(useIssuePageBoundary().wrap(issue(props.id)));
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
			caughtBy="<IssuePageBoundary>"
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
			caughtBy="<IssuePageBoundary>"
			type="Unauthorized"
		>
			Your session expired.
		</ErrorNotice>
	);
}

const [IssuePageBoundary, useIssuePageBoundary] = createErrorBoundary({
	catchTags: { IssueNotFound: NotFound, Unauthorized: SignedOut },
	errors: IssuesClient,
	name: "IssuePage",
	parent: AppBoundary,
});

function IssuePanel(props: { readonly id: IssueId }) {
	return (
		<IssuePageBoundary>
			<Suspense fallback={<Skeleton className="h-12 w-full" />}>
				<IssueTitle id={props.id} />
			</Suspense>
		</IssuePageBoundary>
	);
}

/** The issue the demo shows, kept across the inline and expanded views. */
const selectedAtom = Atom.make(ids[0] ?? IssueId.make(1)).pipe(
	Atom.keepAlive,
	Atom.withLabel("demo-kit:every-tag-caught-issue"),
);

/** Queues a failure for the next request. */
function Controls() {
	return <IssueFailureButtons issueId={useAtomValue(selectedAtom)} />;
}

function EveryTagCaughtDemo() {
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
						name: "<IssuePageBoundary>",
					},
					{ claims: ["RpcClientError"], name: "<AppBoundary>" },
				]}
				reader="<IssueTitle>"
			/>
		</div>
	);
}

export default defineDemo({
	Component: EveryTagCaughtDemo,
	Controls,
	hint: "Open issue #404, then queue a failure and press Try again. <IssuePageBoundary> catches IssueNotFound and Unauthorized, and <AppBoundary> catches RpcClientError, a request that never reached the server. A Crash isn’t a typed error, so it reaches the app’s error boundary as unknown.",
	title: "Every tag caught",
});
