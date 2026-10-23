import { cn } from "@examples/ui/lib/utils";

import { formatMs, phaseText, stateFill, stateTint } from "./state.tsx";
import { type AtomPhase, type AtomTrack, currentSegment } from "./trace.ts";

const steps = ["initial", "success", "failure"] as const;
type Step = (typeof steps)[number];

const stepLabels = {
	failure: "Failure",
	initial: "Initial",
	success: "Success",
} satisfies Record<Step, string>;

const stepOf = (phase: AtomPhase): Step =>
	phase.status === "defect" || phase.status === "interrupted"
		? "failure"
		: phase.status;

/**
 * An `AsyncResult`'s three states, with the current one lit. Waiting isn't a
 * state of its own: it's a flag on the current one, so a pill is striped
 * while its result waits, such as `Initial` before the first response or
 * `Success` while it refreshes.
 */
function Stepper(props: { readonly track: AtomTrack }) {
	const visited = new Set(
		props.track.segments.map((segment) => stepOf(segment.phase)),
	);
	const current = currentSegment(props.track);
	const phase = current?.phase ?? { status: "initial" };
	const waiting = current?.waiting ?? false;
	const failed = props.track.segments.findLast(
		(segment) => stepOf(segment.phase) === "failure",
	);
	return (
		<ol className="flex flex-wrap items-center gap-1 font-mono text-[10px]">
			{steps.map((step, index) => {
				const active = stepOf(phase) === step;
				return (
					<li className="flex items-center gap-1" key={step}>
						{index > 0 ? (
							<span aria-hidden className="h-px w-2 bg-border" />
						) : null}
						<span
							aria-current={active ? "step" : undefined}
							className={cn(
								"flex items-center gap-1 rounded-full px-1.5 py-0.5 ring-1 ring-inset transition-colors duration-300 motion-reduce:transition-none",
								active
									? cn(
											stateTint[waiting ? "waiting" : phase.status],
											waiting && stateFill.waiting,
											"font-semibold text-foreground",
										)
									: "text-muted-foreground ring-transparent",
								!active && visited.has(step) && "ring-border",
								active && phase.status === "defect" && "text-destructive",
							)}
						>
							<span
								aria-hidden
								className={cn(
									"size-1.5 rounded-full",
									active || visited.has(step)
										? stateFill[
												step === "failure" && failed !== undefined
													? failed.phase.status
													: step
											]
										: "bg-border",
								)}
							/>
							{step === "failure" && failed !== undefined
								? phaseText(failed.phase)
								: stepLabels[step]}
							{active && waiting ? (
								<span className="font-normal">· waiting</span>
							) : null}
						</span>
					</li>
				);
			})}
		</ol>
	);
}

/**
 * An atom's state as the code reading it sees it: where it is between
 * `Initial`, waiting, and a `Success` or `Failure`, with a timer while it
 * waits.
 */
function AtomNode(props: { readonly now: number; readonly track: AtomTrack }) {
	const track = props.track;
	const current = currentSegment(track);
	const waitingSince = current?.waiting === true ? current.from : undefined;
	const lastWait = track.segments.findLast(
		(segment) => segment.waiting && segment.to !== undefined,
	);
	return (
		<li
			className={cn(
				"grid gap-1.5 rounded-md border bg-background/60 px-2 py-1.5 transition-opacity duration-500 motion-reduce:transition-none",
				track.removedAt !== undefined && "opacity-50",
			)}
		>
			<div className="flex items-center justify-between gap-2 font-mono text-[11px]">
				<span className="truncate font-medium" title={track.label}>
					{track.label}
				</span>
				<span className="shrink-0 text-muted-foreground tabular-nums">
					{waitingSince === undefined
						? lastWait?.to === undefined
							? null
							: `took ${formatMs(lastWait.to - lastWait.from)}`
						: formatMs(props.now - waitingSince)}
					{" · "}
					{track.removedAt === undefined
						? track.readers === 0
							? "unread"
							: `${track.readers} reading`
						: "removed"}
				</span>
			</div>
			<Stepper track={track} />
		</li>
	);
}

/** The demo's atoms, newest last, each with its state machine. */
export function AtomNodes(props: {
	readonly now: number;
	readonly tracks: ReadonlyArray<AtomTrack>;
}) {
	const live = props.tracks.filter(
		(track) =>
			track.removedAt === undefined || props.now - track.removedAt < 4000,
	);
	if (live.length === 0) {
		return (
			<p className="rounded-md border border-dashed py-3 text-center text-xs text-muted-foreground">
				No atoms in the registry yet.
			</p>
		);
	}
	return (
		<ul aria-label="Atoms" className="grid gap-1.5">
			{live.slice(-4).map((track) => (
				<AtomNode key={track.label} now={props.now} track={track} />
			))}
		</ul>
	);
}
