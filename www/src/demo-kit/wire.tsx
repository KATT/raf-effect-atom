import { cn } from "@examples/ui/lib/utils";
import { Atom, Cpu } from "lucide-react";

import { formatMs, OutcomeChip, stateFill } from "./state.tsx";
import type { TracedRequest } from "./trace.ts";

/** How long a settled request stays on the wire. */
const lingerMs = 2500;

/** Where a request is: on its way out, at the server, or back. */
const placeOf = (request: TracedRequest) => {
	if (request.outcome !== undefined) {
		return "settled";
	}
	if (request.respondedAt !== undefined) {
		return "returning";
	}
	return request.receivedAt === undefined ? "sent" : "server";
};

function ServerCell(props: {
	readonly now: number;
	readonly request: TracedRequest;
}) {
	const request = props.request;
	if (request.receivedAt === undefined) {
		return <span className="text-muted-foreground">…</span>;
	}
	const done = request.respondedAt !== undefined;
	const elapsed = (request.respondedAt ?? props.now) - request.receivedAt;
	const progress =
		request.latency === undefined || request.latency === 0
			? 1
			: Math.min(elapsed / (request.latency * 1.5), 1);
	return (
		<span className="grid gap-0.5">
			<span
				className={cn("tabular-nums", done && "text-muted-foreground")}
				title={
					request.latency === undefined
						? undefined
						: `The server waits about ${request.latency} ms, ± 50%`
				}
			>
				{formatMs(elapsed)}
			</span>
			<span className="h-1 overflow-hidden rounded-full bg-muted">
				<span
					className={cn(
						"block h-full rounded-full",
						done ? "bg-state-wire/60" : stateFill.waiting,
					)}
					style={{ width: `${progress * 100}%` }}
				/>
			</span>
		</span>
	);
}

function WireRow(props: {
	readonly now: number;
	readonly request: TracedRequest;
}) {
	const request = props.request;
	const place = placeOf(request);
	const outcome = request.outcome;
	return (
		<li className="grid grid-cols-[minmax(0,10rem)_minmax(3rem,1fr)_4.5rem] items-center gap-2">
			<span className="grid min-w-0 justify-items-start gap-0.5">
				<span className="w-full truncate" title={request.label}>
					{request.label}
				</span>
				{outcome === undefined ? null : <OutcomeChip outcome={outcome} />}
			</span>
			<span className="relative h-4">
				<span
					aria-hidden
					className="absolute inset-x-0 top-1/2 border-t border-dashed border-muted-foreground/40"
				/>
				<span
					aria-hidden
					className={cn(
						"absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-sm ring-2 ring-background transition-[left] duration-300 ease-out motion-reduce:transition-none",
						place === "sent" || place === "server"
							? "left-full starting:left-0"
							: "left-0",
						outcome === undefined ? "bg-state-wire" : stateFill[outcome.status],
					)}
				/>
			</span>
			<ServerCell now={props.now} request={request} />
		</li>
	);
}

/**
 * The requests on the wire between the demo's registry and its worker: each
 * leaves the registry, waits at the server for its latency, and comes back
 * with its outcome.
 */
export function Wire(props: {
	readonly now: number;
	readonly requests: ReadonlyArray<TracedRequest>;
}) {
	const shown = props.requests
		.filter(
			(request) =>
				request.endedAt === undefined || props.now - request.endedAt < lingerMs,
		)
		.slice(-4);
	return (
		<div className="grid gap-1.5 font-mono text-[11px]">
			<div className="grid grid-cols-[minmax(0,10rem)_minmax(3rem,1fr)_4.5rem] items-center gap-2 text-muted-foreground">
				<span className="flex items-center gap-1">
					<Atom aria-hidden className="size-3" /> Registry
				</span>
				<span />
				<span className="flex items-center gap-1">
					<Cpu aria-hidden className="size-3" /> Worker
				</span>
			</div>
			{shown.length === 0 ? (
				<p className="rounded-md border border-dashed py-3 text-center font-sans text-xs text-muted-foreground">
					Nothing on the wire.
				</p>
			) : (
				<ul aria-label="Requests in flight" className="grid gap-1.5">
					{shown.map((request) => (
						<WireRow key={request.id} now={props.now} request={request} />
					))}
				</ul>
			)}
		</div>
	);
}
