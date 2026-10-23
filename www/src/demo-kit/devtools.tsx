import { RegistryContext, useAtomValue } from "@effect/atom-react";
import { Button } from "@examples/ui/components/button";
import { cn } from "@examples/ui/lib/utils";
import { Option, Predicate } from "effect";
import { AsyncResult, Atom, type AtomRegistry } from "effect/reactivity";
import { RotateCw } from "lucide-react";
import { useContext } from "react";

import { phaseText, stateOf } from "./state.tsx";
import { phaseOf } from "./trace.ts";

/** A node's value in a few words, and whether it's a placeholder. */
const describe = (node: AtomRegistry.Node<unknown>) => {
	const value = Option.getOrUndefined(node.valueOption());
	if (AsyncResult.isAsyncResult(value)) {
		const phase = phaseOf(value);
		return {
			muted: false,
			text:
				stateOf(phase, value.waiting) === "waiting"
					? `${phaseText(phase)}, waiting`
					: phaseText(phase),
		};
	}
	if (value === undefined || value === null) {
		return { muted: true, text: String(value) };
	}
	if (Predicate.isObject(value)) {
		return { muted: true, text: value.constructor?.name ?? "object" };
	}
	return { muted: false, text: String(value) };
};

interface NodeRow {
	readonly atom: Atom.Atom<unknown>;
	readonly children: number;
	readonly label: string | undefined;
	readonly listeners: number;
	readonly state: string;
	readonly value: ReturnType<typeof describe>;
}

const rowsOf = (registry: AtomRegistry.AtomRegistry) =>
	Array.from(registry.getNodes().values(), (node): NodeRow => ({
		atom: node.atom,
		children: node.children.size,
		label: node.atom.label?.[0],
		listeners: node.listeners.size,
		state: node.currentState(),
		value: describe(node),
	}));

/** The registry's nodes, read four times a second while the tab is open. */
const nodesAtom = Atom.make((get) => {
	const timer = setInterval(() => {
		get.setSelf(rowsOf(get.registry));
	}, 250);
	get.addFinalizer(() => {
		clearInterval(timer);
	});
	return rowsOf(get.registry);
}).pipe(Atom.withLabel("demo-kit:devtools"));

const columns =
	"grid grid-cols-[minmax(0,1fr)_6rem_7rem_3rem_2rem] items-center gap-x-2";

/**
 * Every node in the demo's registry, the anonymous ones included: the
 * client's runtime, its queries, and what derives from them. Refresh reruns
 * an atom, as a boundary's `reset` does.
 */
export function Devtools() {
	const registry = useContext(RegistryContext);
	const nodes = useAtomValue(nodesAtom);
	return (
		<div aria-label="Registry" className="font-mono text-[11px]" role="table">
			<div className={cn(columns, "pb-1 text-muted-foreground")} role="row">
				<span role="columnheader">Atom</span>
				<span role="columnheader">State</span>
				<span role="columnheader">Value</span>
				<span role="columnheader" title="Listeners, then dependents">
					Uses
				</span>
				<span className="sr-only" role="columnheader">
					Refresh
				</span>
			</div>
			{nodes.map((node, index) => {
				const label = node.label;
				return (
					<div
						className={cn(columns, "border-t py-1")}
						// Nodes have no id; the registry keeps them in insertion order.
						key={label ?? `anonymous-${index}`}
						role="row"
					>
						<span
							className={cn("truncate", !label && "text-muted-foreground")}
							role="cell"
							title={label}
						>
							{label ?? "anonymous"}
						</span>
						<span className="text-muted-foreground" role="cell">
							{node.state}
						</span>
						<span
							className={cn(
								"min-w-0 truncate",
								node.value.muted && "text-muted-foreground",
							)}
							role="cell"
						>
							{node.value.text}
						</span>
						<span className="tabular-nums" role="cell">
							{node.listeners}/{node.children}
						</span>
						<span role="cell">
							<Button
								aria-label={`Refresh ${label ?? "atom"}`}
								onClick={() => {
									registry.refresh(node.atom);
								}}
								size="icon-xs"
								variant="ghost"
							>
								<RotateCw />
							</Button>
						</span>
					</div>
				);
			})}
		</div>
	);
}
