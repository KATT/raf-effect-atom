import { cn } from "@examples/ui/lib/utils";

import type { AtomPhase, Outcome } from "./trace.ts";

/** What the visuals colour: an atom's phase, or that it's waiting. */
export type State = AtomPhase["status"] | "waiting";

export const stateOf = (phase: AtomPhase, waiting: boolean): State =>
	waiting ? "waiting" : phase.status;

/** Solid fills, for bars and dots. */
export const stateFill = {
	defect: "bg-state-defect",
	failure: "bg-state-failure",
	initial: "bg-state-initial/40",
	interrupted: "bg-state-initial/60",
	success: "bg-state-success",
	waiting: "waiting-stripes motion-safe:animate-stripes",
} satisfies Record<State, string>;

/** Tints, for chips with text on them. */
export const stateTint = {
	defect: "bg-state-defect/15 ring-state-defect/50",
	failure: "bg-state-failure/20 ring-state-failure/60",
	initial: "bg-muted ring-border",
	interrupted: "bg-muted ring-border",
	success: "bg-state-success/15 ring-state-success/50",
	waiting: "bg-state-waiting/15 ring-state-waiting/50",
} satisfies Record<State, string>;

/** A phase in a word: `Initial`, `Success`, a typed error's tag, or `unknown`. */
export const phaseText = (phase: AtomPhase) => {
	switch (phase.status) {
		case "defect": {
			return "unknown";
		}
		case "failure": {
			return phase.error;
		}
		case "initial": {
			return "Initial";
		}
		case "interrupted": {
			return "Interrupted";
		}
		case "success": {
			return "Success";
		}
	}
};

/** An outcome as a small chip: its tag on a tint of its colour. */
export function OutcomeChip(props: {
	readonly className?: string;
	readonly outcome: Outcome;
}) {
	const state = props.outcome.status;
	return (
		<span
			className={cn(
				"inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[11px] ring-1 ring-inset",
				stateTint[state],
				state === "defect" && "font-semibold text-destructive",
				props.className,
			)}
		>
			<span
				aria-hidden
				className={cn("size-1.5 shrink-0 rounded-full", stateFill[state])}
			/>
			{state === "defect" ? "Die: unknown" : phaseText(props.outcome)}
		</span>
	);
}

/** Milliseconds, as a trace shows them: `412 ms`, or `1.2 s` from a second. */
export const formatMs = (ms: number) =>
	ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
