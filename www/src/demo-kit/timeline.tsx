import { cn } from "@examples/ui/lib/utils";

import { useReducedMotion } from "./now.ts";
import { formatMs, phaseText, stateFill, stateOf } from "./state.tsx";
import type { AtomTrack, TracedRequest } from "./trace.ts";

const spanMs = 6000;
/** With reduced motion, the window moves a page at a time. */
const pageMs = 3000;

interface Window {
	readonly end: number;
	readonly start: number;
}

/**
 * The window follows the clock while anything is in flight, and stops just
 * after the last thing that happened, so a settled trace holds still.
 */
const windowOf = (
	tracks: ReadonlyArray<AtomTrack>,
	requests: ReadonlyArray<TracedRequest>,
	now: number,
	reduced: boolean,
): Window | undefined => {
	const times = [
		...tracks.flatMap((track) =>
			track.segments.flatMap((segment) => [segment.from, segment.to ?? 0]),
		),
		...requests.flatMap((request) => [request.sentAt, request.endedAt ?? 0]),
	];
	if (times.length === 0) {
		return undefined;
	}
	const active =
		requests.some((request) => request.endedAt === undefined) ||
		tracks.some((track) => {
			const last = track.segments.at(-1);
			return track.removedAt === undefined && last?.waiting === true;
		});
	const last = Math.max(...times);
	const raw = active ? now : Math.min(now, last + 400);
	const end = reduced ? (Math.floor(raw / pageMs) + 1) * pageMs : raw;
	return { end, start: end - spanMs };
};

const position = (window: Window, from: number, to: number) => {
	const left = Math.max(from, window.start);
	const right = Math.min(to, window.end);
	if (right <= left) {
		return undefined;
	}
	return {
		left: `${((left - window.start) / spanMs) * 100}%`,
		width: `${((right - left) / spanMs) * 100}%`,
	};
};

function Lane(props: {
	readonly children: React.ReactNode;
	readonly label: string;
	readonly muted?: boolean;
}) {
	return (
		<li className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-center gap-2">
			<span
				className={cn("truncate", props.muted && "text-muted-foreground")}
				title={props.label}
			>
				{props.label}
			</span>
			<span className="relative h-3.5 overflow-hidden rounded-sm bg-muted/50">
				{props.children}
			</span>
		</li>
	);
}

function AtomLane(props: {
	readonly now: number;
	readonly track: AtomTrack;
	readonly window: Window;
}) {
	return (
		<Lane label={props.track.label} muted={props.track.removedAt !== undefined}>
			{props.track.segments.map((segment) => {
				const style = position(
					props.window,
					segment.from,
					segment.to ?? props.now,
				);
				return style === undefined ? null : (
					<span
						className={cn(
							"absolute inset-y-0 border-r border-background",
							stateFill[stateOf(segment.phase, segment.waiting)],
						)}
						key={segment.from}
						style={style}
						title={`${segment.waiting ? "Waiting" : phaseText(segment.phase)}, ${formatMs((segment.to ?? props.now) - segment.from)}`}
					/>
				);
			})}
		</Lane>
	);
}

function RequestLane(props: {
	readonly now: number;
	readonly request: TracedRequest;
	readonly window: Window;
}) {
	const request = props.request;
	const end = request.endedAt ?? props.now;
	const wire = position(props.window, request.sentAt, end);
	const server =
		request.receivedAt === undefined
			? undefined
			: position(
					props.window,
					request.receivedAt,
					request.respondedAt ?? props.now,
				);
	const settled =
		request.endedAt === undefined || request.outcome === undefined
			? undefined
			: position(props.window, request.endedAt - 60, request.endedAt);
	return (
		<Lane label={request.label}>
			{wire === undefined ? null : (
				<span
					className="absolute top-1/2 h-px -translate-y-1/2 bg-state-wire"
					style={wire}
				/>
			)}
			{server === undefined ? null : (
				<span
					className={cn(
						"absolute inset-y-0.5 rounded-sm",
						request.respondedAt === undefined
							? stateFill.waiting
							: "bg-state-wire/70",
					)}
					style={server}
					title={`At the server for ${formatMs((request.respondedAt ?? props.now) - (request.receivedAt ?? 0))}`}
				/>
			)}
			{settled === undefined || request.outcome === undefined ? null : (
				<span
					className={cn(
						"absolute inset-y-0 rounded-sm",
						stateFill[request.outcome.status],
					)}
					style={settled}
				/>
			)}
		</Lane>
	);
}

function describe(
	tracks: ReadonlyArray<AtomTrack>,
	requests: ReadonlyArray<TracedRequest>,
) {
	const atoms = tracks.map((track) => {
		const last = track.segments.at(-1);
		return `${track.label} is ${last === undefined ? "Initial" : last.waiting ? "waiting" : phaseText(last.phase)}`;
	});
	const sent = requests.map((request) =>
		request.endedAt === undefined || request.outcome === undefined
			? `${request.label} is in flight`
			: `${request.label} ended with ${phaseText(request.outcome)} after ${formatMs(request.endedAt - request.sentAt)}`,
	);
	return [...atoms, ...sent].join(". ");
}

/**
 * The last six seconds: a lane per atom, coloured by its state, and a lane
 * per request, a line while it's on the wire and a bar while the worker has
 * it, ending in its outcome.
 */
export function Timeline(props: {
	readonly now: number;
	readonly requests: ReadonlyArray<TracedRequest>;
	readonly tracks: ReadonlyArray<AtomTrack>;
}) {
	const reduced = useReducedMotion();
	const window = windowOf(props.tracks, props.requests, props.now, reduced);
	if (window === undefined) {
		return null;
	}
	const requests = props.requests
		.filter((request) => (request.endedAt ?? props.now) >= window.start)
		.slice(-5);
	const tracks = props.tracks.filter(
		(track) => (track.removedAt ?? props.now) >= window.start,
	);
	return (
		<figure className="grid gap-1.5 font-mono text-[11px]">
			<figcaption className="sr-only">{describe(tracks, requests)}</figcaption>
			<ul aria-hidden className="grid gap-1">
				{tracks.map((track) => (
					<AtomLane
						key={track.label}
						now={props.now}
						track={track}
						window={window}
					/>
				))}
				{tracks.length > 0 && requests.length > 0 ? (
					<li className="border-t" />
				) : null}
				{requests.map((request) => (
					<RequestLane
						key={request.id}
						now={props.now}
						request={request}
						window={window}
					/>
				))}
			</ul>
			<div
				aria-hidden
				className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-2 text-[10px] text-muted-foreground"
			>
				<span />
				<span className="flex justify-between">
					<span>−6 s</span>
					<span>−3 s</span>
					<span>0 s</span>
				</span>
			</div>
		</figure>
	);
}
