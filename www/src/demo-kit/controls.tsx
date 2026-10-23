import { RegistryContext, useAtomValue } from "@effect/atom-react";
import { Button } from "@examples/ui/components/button";
import { cn } from "@examples/ui/lib/utils";
import { Option } from "effect";
import { AsyncResult } from "effect/reactivity";
import { Zap } from "lucide-react";
import { type ReactNode, useContext } from "react";

import { controlsAtom, failNext, setLatency } from "./client.ts";
import { type InjectedError, latencies } from "./rpcs.ts";

/** The demo server's controls, once its worker answered. */
function useControls() {
	const controls = useAtomValue(controlsAtom);
	return Option.getOrUndefined(AsyncResult.value(controls));
}

/** Picks how long the demo server takes to answer. */
export function LatencyControl() {
	const registry = useContext(RegistryContext);
	const latency = useControls()?.latency;
	return (
		<div
			aria-label="Server latency"
			className="inline-flex rounded-md border p-0.5"
			role="radiogroup"
		>
			{latencies.map((option) => (
				<button
					aria-checked={latency === option.ms}
					className={cn(
						"rounded px-2 py-0.5 text-xs text-muted-foreground",
						latency === option.ms && "bg-accent font-medium text-foreground",
					)}
					key={option.ms}
					onClick={() => {
						setLatency(registry, option.ms);
					}}
					role="radio"
					title={`The server answers in about ${option.ms} ms`}
					type="button"
				>
					{option.label}
				</button>
			))}
		</div>
	);
}

/**
 * Makes the demo server fail its next `count` requests with what `make`
 * returns: one of the contract's errors, or a `Crash` no procedure declares.
 * The badge counts the failures still queued with that tag.
 */
export function FailNextButton(props: {
	readonly count?: number;
	readonly make: () => InjectedError;
	/** The tag of what `make` returns, for the label. */
	readonly tag: string;
}) {
	const registry = useContext(RegistryContext);
	const queued =
		useControls()?.queued.filter((tag) => tag === props.tag).length ?? 0;
	const count = props.count ?? 1;
	return (
		<Button
			onClick={() => {
				failNext(registry, count, props.make);
			}}
			size="xs"
			variant="outline"
		>
			<Zap />
			{count === 1
				? `Fail with ${props.tag}`
				: `Fail ${count} with ${props.tag}`}
			{queued > 0 ? (
				<span className="rounded bg-destructive/15 px-1 text-destructive tabular-nums">
					{queued}
				</span>
			) : null}
		</Button>
	);
}

/**
 * A failure as the code that handled it sees it: who caught it and the type
 * its `error` has there, so a demo shows what the types promise. An error of
 * type `unknown` is red.
 */
export function ErrorNotice(props: {
	readonly action?: ReactNode;
	/** Who got the error, e.g. `<IssueBoundary>` or `AsyncResult`. */
	readonly caughtBy: string;
	readonly children: ReactNode;
	/** The type of `error` where it was caught, e.g. `IssueNotFound` or `unknown`. */
	readonly type: string;
}) {
	return (
		<div
			className={cn(
				"grid justify-items-start gap-2 rounded-md border p-3 text-sm",
				props.type === "unknown"
					? "border-destructive/40 bg-destructive/10"
					: "border-amber-500/40 bg-amber-500/10",
			)}
			role="alert"
		>
			<p className="flex flex-wrap items-center gap-1.5 font-mono text-xs">
				<span className="rounded bg-background/70 px-1.5 py-0.5">
					{props.caughtBy}
				</span>
				<span className="text-muted-foreground">error:</span>
				<span
					className={cn(
						"font-semibold",
						props.type === "unknown" && "text-destructive",
					)}
				>
					{props.type}
				</span>
			</p>
			<div>{props.children}</div>
			{props.action}
		</div>
	);
}
