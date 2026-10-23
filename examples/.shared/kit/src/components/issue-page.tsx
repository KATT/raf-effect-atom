import { Button } from "@examples/ui/components/button";
import { Skeleton } from "@examples/ui/components/skeleton";
import type { ReactNode } from "react";

/** The title, date, and description while the issue loads. The id is in the URL. */
export function IssueBodySkeleton(props: { readonly id: number }) {
	return (
		<div className="grid gap-6">
			<div className="flex items-baseline gap-2">
				<Skeleton className="h-9 min-w-0 flex-1" />
				<span className="shrink-0 text-lg text-muted-foreground">
					#{props.id}
				</span>
			</div>
			<Skeleton className="h-5 w-40" />
			<Skeleton className="h-28" />
		</div>
	);
}

/**
 * What a boundary renders for a typed failure: which boundary caught it, the
 * error's tag, a message, and an optional action such as Retry.
 */
export function CaughtError(props: {
	readonly action?: { readonly label: string; readonly onClick: () => void };
	readonly boundary: string;
	readonly children: ReactNode;
	readonly tag: string;
}) {
	return (
		<div
			className="grid justify-items-start gap-3 rounded-lg border border-dashed p-6"
			data-boundary={props.boundary}
			data-tag={props.tag}
			role="alert"
		>
			<p className="text-xs text-muted-foreground">
				<code className="font-mono">{props.tag}</code>, caught by{" "}
				<code className="font-mono">{props.boundary}</code>
			</p>
			<div className="text-sm">{props.children}</div>
			{props.action === undefined ? null : (
				<Button onClick={props.action.onClick} size="sm" variant="outline">
					{props.action.label}
				</Button>
			)}
		</div>
	);
}
