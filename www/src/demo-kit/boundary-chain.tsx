import { useAtomValue } from "@effect/atom-react";
import { cn } from "@examples/ui/lib/utils";
import { ArrowUp, ShieldCheck } from "lucide-react";

import { useNow, useReducedMotion } from "./now.ts";
import { phaseText } from "./state.tsx";
import { atomTracksAtom } from "./trace.ts";

/** A boundary in the chain: who it is, and the tags it claims. */
export interface ChainLevel {
	readonly claims: ReadonlyArray<string>;
	readonly name: string;
}

/** How long an error takes to climb one level. */
const hopMs = 450;

/** The atom's latest failure, and when it happened. */
const useLatestFailure = (label: string) => {
	const tracks = useAtomValue(atomTracksAtom);
	const track = tracks.find((each) => each.label === label);
	const last = track?.segments.at(-1);
	if (
		last === undefined ||
		last.waiting ||
		(last.phase.status !== "failure" && last.phase.status !== "defect")
	) {
		return undefined;
	}
	return { at: last.from, tag: phaseText(last.phase) };
};

/**
 * The boundaries above a read, innermost first, with the app's boundary on
 * top: when the read's atom fails, its error climbs a level at a time,
 * passes each boundary that doesn't claim its tag, and stops at the first
 * that does. A defect, typed `unknown`, climbs to the app's boundary.
 */
export function BoundaryChain(props: {
	/** The atom the read reads, by its trace label, e.g. `GetIssue:1`. */
	readonly atom: string;
	readonly levels: ReadonlyArray<ChainLevel>;
	/** The component that reads, e.g. `<IssueTitle>`. */
	readonly reader: string;
}) {
	const now = useNow();
	const reduced = useReducedMotion();
	const failure = useLatestFailure(props.atom);
	const levels = [
		...props.levels,
		{ claims: ["unknown"], name: "the app's error boundary" },
	];
	const catcher =
		failure === undefined
			? undefined
			: levels.findIndex(
					(level, index) =>
						level.claims.includes(failure.tag) || index === levels.length - 1,
				);
	const reached =
		failure === undefined
			? -1
			: reduced
				? Number.POSITIVE_INFINITY
				: Math.floor((now - failure.at) / hopMs);
	const rows = levels.toReversed();
	return (
		<figure className="grid gap-1.5 rounded-lg border bg-muted/20 p-3 font-mono text-[11px]">
			<figcaption className="sr-only">
				{failure === undefined || catcher === undefined
					? `${props.reader} reads ${props.atom}; nothing has failed.`
					: `${props.atom} failed with ${failure.tag}. ${levels
							.slice(0, catcher)
							.map((level) => `${level.name} doesn't claim it`)
							.join(
								", ",
							)}${catcher > 0 ? ", so " : ""}${levels[catcher]?.name ?? ""} catches it.`}
			</figcaption>
			<ol aria-hidden className="grid gap-1">
				{rows.map((level, row) => {
					const index = levels.length - 1 - row;
					const isCatcher = catcher === index && reached >= index + 1;
					const passed =
						catcher !== undefined && index < catcher && reached >= index + 1;
					const here =
						failure !== undefined &&
						catcher !== undefined &&
						Math.min(reached, catcher + 1) === index + 1;
					return (
						<li
							className={cn(
								"flex flex-wrap items-center justify-between gap-2 rounded-md border bg-background px-2 py-1.5 transition-colors duration-300 motion-reduce:transition-none",
								isCatcher &&
									(failure?.tag === "unknown"
										? "border-state-defect bg-state-defect/10"
										: "border-state-failure bg-state-failure/15"),
								passed && "border-dashed",
							)}
							key={level.name}
							style={{ marginInlineStart: `${row * 0.75}rem` }}
						>
							<span className="flex items-center gap-1.5">
								<ShieldCheck
									className={cn(
										"size-3.5 text-muted-foreground",
										isCatcher && "text-foreground",
									)}
								/>
								<span className={cn(isCatcher && "font-semibold")}>
									{level.name}
								</span>
							</span>
							<span className="flex flex-wrap items-center gap-1 text-muted-foreground">
								{passed ? (
									<span className="flex items-center gap-0.5">
										<ArrowUp className="size-3" /> passes {failure?.tag}
									</span>
								) : null}
								{isCatcher ? (
									<span
										className={cn(
											"font-semibold text-foreground",
											failure?.tag === "unknown" && "text-destructive",
										)}
									>
										caught {failure?.tag}
									</span>
								) : passed ? null : (
									<span>
										claims{" "}
										{level.claims.map((claim) => (
											<span
												className={cn(
													"rounded px-1",
													claim === "unknown"
														? "bg-state-defect/10"
														: "bg-muted",
												)}
												key={claim}
											>
												{claim === "unknown" ? "anything" : claim}
											</span>
										))}
									</span>
								)}
								{here && !isCatcher ? (
									<span className="rounded bg-state-failure/25 px-1 text-foreground">
										{failure?.tag} ↑
									</span>
								) : null}
							</span>
						</li>
					);
				})}
				<li
					className={cn(
						"flex items-center justify-between gap-2 rounded-md border border-dashed px-2 py-1.5",
						failure !== undefined && reached < 1 && "border-state-failure",
					)}
					style={{ marginInlineStart: `${rows.length * 0.75}rem` }}
				>
					<span>
						{props.reader} reads {props.atom}
					</span>
					{failure === undefined ? null : (
						<span
							className={cn(
								"rounded px-1",
								failure.tag === "unknown"
									? "bg-state-defect/15 text-destructive"
									: "bg-state-failure/25",
							)}
						>
							throws {failure.tag}
						</span>
					)}
				</li>
			</ol>
		</figure>
	);
}
