import { Button } from "@examples/ui/components/button";
import { Skeleton } from "@examples/ui/components/skeleton";
import { IssueId, IssueNotFound, Unauthorized } from "@examples/contract";
import { useAtomSuspense } from "@effect/atom-react";
import { AtomErrorBoundary, type CatchTagProps } from "effect-atom-boundary";
import { Suspense, useState } from "react";

import { AppBoundary } from "~/demo-kit/app-boundary.tsx";
import { BoundaryChain } from "~/demo-kit/boundary-chain.tsx";
import { ErrorNotice, FailNextButton } from "~/demo-kit/controls.tsx";
import { defineDemo } from "~/demo-kit/define.ts";
import { Crash } from "~/demo-kit/rpcs.ts";

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
			catchTags={{ IssueNotFound: NotFound, Unauthorized: SignedOut }}
		>
			<Suspense fallback={<Skeleton className="h-12 w-full" />}>
				<IssueTitle id={props.id} />
			</Suspense>
		</AtomErrorBoundary>
	);
}

function AtomErrorBoundaryDemo() {
	const [id, setId] = useState(ids[0] ?? IssueId.make(1));
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
			<AppBoundary>
				<IssuePanel id={id} />
			</AppBoundary>
			<BoundaryChain
				atom={`GetIssue:${id}`}
				levels={[
					{
						claims: ["IssueNotFound", "Unauthorized"],
						name: "<AtomErrorBoundary>",
					},
				]}
				reader="<IssueTitle>"
			/>
			<div className="flex flex-wrap gap-2 border-t pt-3">
				<FailNextButton make={() => new Unauthorized()} tag="Unauthorized" />
				<FailNextButton
					make={() => new IssueNotFound({ id })}
					tag="IssueNotFound"
				/>
				<FailNextButton
					make={() => new Crash({ message: "The server threw" })}
					tag="Crash"
				/>
			</div>
		</div>
	);
}

export default defineDemo({
	Component: AtomErrorBoundaryDemo,
	hint: "Open issue #404, then queue a failure and press Try again. IssueNotFound and Unauthorized have handlers; a Crash isn’t a typed error, so it reaches the app’s error boundary as unknown.",
	title: "AtomErrorBoundary",
});
