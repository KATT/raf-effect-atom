import { Button } from "@examples/ui/components/button";
import { Skeleton } from "@examples/ui/components/skeleton";
import {
	IssueId,
	type IssueNotFound,
	type Unauthorized,
} from "@examples/contract";
import { type CatchTagProps, createErrorBoundary } from "effect-atom-boundary";
import { RegistryContext, useAtomSet, useAtomValue } from "@effect/atom-react";
import { type Handle, Loader, useAtomResult } from "raf-effect-atom";
import { Atom } from "effect/reactivity";
import { Suspense, use, useState } from "react";

import { AppBoundary, AppErrorBoundary } from "~/demo-kit/app-boundary.tsx";
import { BoundaryChain } from "~/demo-kit/boundary-chain.tsx";
import { IssuesClient } from "~/demo-kit/client.ts";
import { ErrorNotice, IssueFailureButtons } from "~/demo-kit/controls.tsx";
import { defineDemo } from "~/demo-kit/define.ts";

import { issue } from "./issue-atoms.ts";

function SignedOut(props: CatchTagProps<Unauthorized>) {
	return (
		<ErrorNotice
			action={
				<Button onClick={props.reset} size="xs" variant="outline">
					Sign in again
				</Button>
			}
			caughtBy="<AuthBoundary>"
			type="Unauthorized"
		>
			Your session expired.
		</ErrorNotice>
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
			caughtBy="<IssueBoundary>"
			type="IssueNotFound"
		>
			There’s no issue #{props.error.id}.
		</ErrorNotice>
	);
}

const [AuthBoundary] = createErrorBoundary({
	catchTags: { Unauthorized: SignedOut },
	errors: IssuesClient,
	name: "Auth",
	parent: AppBoundary,
});

const [IssueBoundary, useIssueBoundary] = createErrorBoundary({
	catchTags: { IssueNotFound: NotFound },
	errors: IssuesClient,
	name: "Issue",
	parent: AuthBoundary,
});

/**
 * Reads an issue under `<IssueBoundary>`: `IssueNotFound` goes to it,
 * `Unauthorized` to `<AuthBoundary>` and `RpcClientError` to `<AppBoundary>`,
 * so no failure is left and the result is a success.
 */
function IssueTitle(props: { readonly issue: Handle<typeof issue> }) {
	const result = useAtomResult(useIssueBoundary().wrap(issue), props.issue);
	return (
		<div className="grid gap-1">
			<p className="font-mono text-xs text-muted-foreground">
				#{result.value.id}
			</p>
			<h3 className="text-lg font-semibold">{result.value.title}</h3>
		</div>
	);
}

const ids = [1, 2, 404].map((id) => IssueId.make(id));

const firstId = ids[0] ?? IssueId.make(1);

/**
 * The issue a button picked, kept across the inline and expanded views:
 * `undefined` until one does.
 */
const selectedAtom = Atom.make<Handle<typeof issue> | undefined>(
	undefined,
).pipe(Atom.keepAlive, Atom.withLabel("demo-kit:boundary-chain-issue"));

/** Queues a failure for the next request. */
function Controls() {
	const id = useAtomValue(selectedAtom)?.args[0] ?? firstId;
	return <IssueFailureButtons issueId={id} />;
}

function BoundaryChainDemo() {
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
					<AuthBoundary>
						<IssueBoundary key={id}>
							<Suspense fallback={<Skeleton className="h-12 w-full" />}>
								<IssueTitle issue={picked} />
							</Suspense>
						</IssueBoundary>
					</AuthBoundary>
				</AppBoundary>
			</AppErrorBoundary>
			<BoundaryChain
				atom={`GetIssue:${id}`}
				levels={[
					{ claims: ["IssueNotFound"], name: "<IssueBoundary>" },
					{ claims: ["Unauthorized"], name: "<AuthBoundary>" },
					{ claims: ["RpcClientError"], name: "<AppBoundary>" },
				]}
				reader="<IssueTitle>"
			/>
		</div>
	);
}

export default defineDemo({
	Component: BoundaryChainDemo,
	Controls,
	hint: "Queue a failure, then open another issue or press Try again. Watch the error climb: IssueNotFound stops at <IssueBoundary>, Unauthorized at <AuthBoundary>, and RpcClientError, a request that never reached the server, at <AppBoundary>. A Crash, typed unknown, climbs to the app’s error boundary.",
	title: "Chained boundaries",
});
