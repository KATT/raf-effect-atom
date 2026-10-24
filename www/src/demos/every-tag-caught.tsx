import { Button } from "@examples/ui/components/button";
import { Skeleton } from "@examples/ui/components/skeleton";
import {
	IssueId,
	type IssueNotFound,
	type Unauthorized,
} from "@examples/contract";
import { RegistryContext, useAtomSet, useAtomValue } from "@effect/atom-react";
import { type CatchTagProps, createErrorBoundary } from "effect-atom-boundary";
import { type Handle, Loader, useAtomResult } from "raf-effect-atom";
import { Atom } from "effect/reactivity";
import { Suspense, use, useState } from "react";

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
function IssueTitle(props: { readonly issue: Handle<typeof issue> }) {
	const result = useIssuePageBoundary(useAtomResult(issue, props.issue));
	return (
		<div className="grid gap-1">
			<p className="font-mono text-xs text-muted-foreground">
				#{result.value.id}
			</p>
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

function IssuePanel(props: { readonly issue: Handle<typeof issue> }) {
	return (
		<IssuePageBoundary key={props.issue.args[0]}>
			<Suspense fallback={<Skeleton className="h-12 w-full" />}>
				<IssueTitle issue={props.issue} />
			</Suspense>
		</IssuePageBoundary>
	);
}

const firstId = ids[0] ?? IssueId.make(1);

/**
 * The issue a button picked, kept across the inline and expanded views:
 * `undefined` until one does.
 */
const selectedAtom = Atom.make<Handle<typeof issue> | undefined>(
	undefined,
).pipe(Atom.keepAlive, Atom.withLabel("demo-kit:every-tag-caught-issue"));

/** Queues a failure for the next request. */
function Controls() {
	const id = useAtomValue(selectedAtom)?.args[0] ?? firstId;
	return <IssueFailureButtons issueId={id} />;
}

function EveryTagCaughtDemo() {
	const registry = use(RegistryContext);
	// Each button starts its issue as it picks it, as an event handler would.
	const [first] = useState(() =>
		Loader.make(registry).prefetch(issue, firstId),
	);
	const picked = useAtomValue(selectedAtom) ?? first;
	const setPicked = useAtomSet(selectedAtom);
	const [id] = picked.args;
	return (
		<div className="grid gap-4">
			<div className="flex flex-wrap gap-1.5">
				{ids.map((each) => (
					<Button
						aria-pressed={each === id}
						key={each}
						onClick={() => {
							setPicked(Loader.make(registry).prefetch(issue, each));
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
					<IssuePanel issue={picked} />
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
