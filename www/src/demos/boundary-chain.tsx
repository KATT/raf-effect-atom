import { Button } from "@examples/ui/components/button";
import { Skeleton } from "@examples/ui/components/skeleton";
import { IssueId, IssueNotFound, Unauthorized } from "@examples/contract";
import { Match, Option } from "effect";
import { type CatchTagProps, createErrorBoundary } from "effect-atom-boundary";
import { AsyncResult } from "effect/reactivity";
import type { RpcClientError } from "effect/rpc";
import { useAtomResult } from "raf-effect-atom";
import { Suspense, useState } from "react";

import { AppBoundary } from "~/demo-kit/app-boundary.tsx";
import { BoundaryChain } from "~/demo-kit/boundary-chain.tsx";
import { IssuesClient } from "~/demo-kit/client.ts";
import { ErrorNotice, FailNextButton } from "~/demo-kit/controls.tsx";
import { defineDemo } from "~/demo-kit/define.ts";
import { Crash } from "~/demo-kit/rpcs.ts";

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
});

const [IssueBoundary, useIssueBoundary] = createErrorBoundary({
	catchTags: { IssueNotFound: NotFound },
	errors: IssuesClient,
	name: "Issue",
	parent: AuthBoundary,
});

/**
 * Reads an issue under `<IssueBoundary>`: `IssueNotFound` goes to it,
 * `Unauthorized` to `<AuthBoundary>`, and what's left is returned.
 */
function useIssue(id: IssueId) {
	return useAtomResult(useIssueBoundary().wrap(issue(id)));
}

function IssueTitle(props: { readonly id: IssueId }) {
	const result = useIssue(props.id);
	if (AsyncResult.isSuccess(result)) {
		return (
			<div className="grid gap-1">
				<p className="font-mono text-xs text-muted-foreground">#{props.id}</p>
				<h3 className="text-lg font-semibold">{result.value.title}</h3>
			</div>
		);
	}
	// useAtomResult throws defects, so a failure it returns has a typed error.
	return Match.valueTags(Option.getOrThrow(AsyncResult.error(result)), {
		RpcClientError: unreachable,
	});
}

function unreachable(error: RpcClientError.RpcClientError) {
	return (
		<ErrorNotice caughtBy="IssueTitle" type="RpcClientError">
			The request didn’t reach the server: {error.reason.message}
		</ErrorNotice>
	);
}

const ids = [1, 2, 404].map((id) => IssueId.make(id));

function BoundaryChainDemo() {
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
				<AuthBoundary>
					<IssueBoundary>
						<Suspense fallback={<Skeleton className="h-12 w-full" />}>
							<IssueTitle id={id} />
						</Suspense>
					</IssueBoundary>
				</AuthBoundary>
			</AppBoundary>
			<BoundaryChain
				atom={`GetIssue:${id}`}
				levels={[
					{ claims: ["IssueNotFound"], name: "<IssueBoundary>" },
					{ claims: ["Unauthorized"], name: "<AuthBoundary>" },
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
	Component: BoundaryChainDemo,
	hint: "Queue a failure, then open another issue or press Try again. Watch the error climb: IssueNotFound stops at <IssueBoundary>, Unauthorized passes it to <AuthBoundary>, and a Crash, typed unknown, climbs to the app’s boundary.",
	title: "Chained boundaries",
});
