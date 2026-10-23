import { useAtomValue } from "@effect/atom-react";
import { cn } from "@examples/ui/lib/utils";

import { AtomNodes } from "./atom-nodes.tsx";
import { useNow } from "./now.ts";
import { formatMs, OutcomeChip, phaseText, stateOf } from "./state.tsx";
import { Timeline } from "./timeline.tsx";
import { atomTracksAtom, currentSegment, requestsAtom } from "./trace.ts";
import { Wire } from "./wire.tsx";

function Section(props: {
	readonly children: React.ReactNode;
	readonly title: string;
}) {
	return (
		<section className="grid gap-1.5">
			<h4 className="text-xs font-medium">{props.title}</h4>
			{props.children}
		</section>
	);
}

/**
 * What the demo is doing, as it happens: its atoms' states, its requests on
 * the wire to the worker, and the last few seconds of both on a timeline.
 */
export function TracePanel() {
	const tracks = useAtomValue(atomTracksAtom);
	const requests = useAtomValue(requestsAtom);
	const now = useNow();
	return (
		<div className="grid gap-4">
			<Section title="Atoms">
				<AtomNodes now={now} tracks={tracks} />
			</Section>
			<Section title="Requests">
				<Wire now={now} requests={requests} />
			</Section>
			<Section title="Timeline">
				<Timeline now={now} requests={requests} tracks={tracks} />
			</Section>
		</div>
	);
}

const columns = "grid grid-cols-[minmax(0,1fr)_8rem_4.5rem] gap-x-2";

/**
 * The demo's atoms and requests as tables: each atom's state and readers,
 * and every request, newest first.
 */
export function QueriesPanel() {
	const tracks = useAtomValue(atomTracksAtom);
	const requests = useAtomValue(requestsAtom);
	const now = useNow();
	return (
		<div className="grid gap-4 font-mono text-[11px]">
			<div aria-label="Atoms" role="table">
				<div className={cn(columns, "pb-1 text-muted-foreground")} role="row">
					<span role="columnheader">Atom</span>
					<span role="columnheader">Result</span>
					<span role="columnheader">Readers</span>
				</div>
				{tracks.toReversed().map((track) => {
					const segment = currentSegment(track);
					return (
						<div
							className={cn(
								columns,
								"items-center border-t py-1",
								track.removedAt !== undefined && "text-muted-foreground",
							)}
							key={track.label}
							role="row"
						>
							<span className="truncate" role="cell" title={track.label}>
								{track.label}
							</span>
							<span role="cell">
								{segment === undefined
									? null
									: stateOf(segment.phase, segment.waiting) === "waiting"
										? `${phaseText(segment.phase)}, waiting`
										: phaseText(segment.phase)}
							</span>
							<span role="cell">
								{track.removedAt === undefined ? track.readers : "removed"}
							</span>
						</div>
					);
				})}
			</div>
			<div aria-label="Requests" role="table">
				<div className={cn(columns, "pb-1 text-muted-foreground")} role="row">
					<span role="columnheader">Request</span>
					<span role="columnheader">Outcome</span>
					<span role="columnheader">Time</span>
				</div>
				{requests.toReversed().map((request) => (
					<div
						className={cn(columns, "items-center border-t py-1")}
						key={request.id}
						role="row"
					>
						<span className="truncate" role="cell" title={request.label}>
							{request.label}
						</span>
						<span role="cell">
							{request.outcome === undefined ? (
								"in flight"
							) : (
								<OutcomeChip outcome={request.outcome} />
							)}
						</span>
						<span className="text-muted-foreground tabular-nums" role="cell">
							{formatMs((request.endedAt ?? now) - request.sentAt)}
						</span>
					</div>
				))}
			</div>
		</div>
	);
}
