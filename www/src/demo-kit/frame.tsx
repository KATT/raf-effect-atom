import { RegistryContext, useAtomMount } from "@effect/atom-react";
import { Button } from "@examples/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "@examples/ui/components/dialog";
import { Skeleton } from "@examples/ui/components/skeleton";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@examples/ui/components/tabs";
import { cn } from "@examples/ui/lib/utils";
import { Option, Predicate } from "effect";
import { AsyncResult, type AtomRegistry } from "effect/reactivity";
import { Expand, FlaskConical, RotateCcw, Shrink } from "lucide-react";
import { makeRegistry } from "raf-effect-atom/tanstack-router";
import { Component, type ReactNode, Suspense, useState } from "react";

import { controlsAtom, serverEventsAtom, setLatency } from "./client.ts";
import { ErrorNotice, LatencyControl } from "./controls.tsx";
import type { DemoDefinition } from "./define.ts";
import { Devtools } from "./devtools.tsx";
import { QueriesPanel, TracePanel } from "./queries-panel.tsx";
import { initialLatency } from "./rpcs.ts";
import { atomTracksAtom } from "./trace.ts";

interface Session {
	readonly id: number;
	/** The demo's atoms, and through `IssuesClient` its worker. */
	readonly registry: AtomRegistry.AtomRegistry;
}

let sessionCount = 0;
// One live session per demo: React can discard a render and run
// `useState`'s initializer again, and a second registry would start a
// second worker.
const liveSessions = new WeakMap<DemoDefinition, Session>();

function createSession(demo: DemoDefinition): Session {
	sessionCount++;
	const session = { id: sessionCount, registry: makeRegistry() };
	liveSessions.set(demo, session);
	return session;
}

/**
 * The demo's fallback for what no boundary in it caught: a defect, or a
 * typed error nothing claimed. Its type here is `unknown`.
 */
interface UncaughtState {
	/** What was thrown: anything, which is why its type is `unknown`. */
	readonly caught: { readonly thrown: unknown } | undefined;
}

class UncaughtBoundary extends Component<
	{ readonly children: ReactNode; readonly onStartOver: () => void },
	UncaughtState
> {
	override state: UncaughtState = { caught: undefined };

	// oxlint-disable-next-line anti-slop/no-unknown-parameters -- React passes whatever was thrown
	static getDerivedStateFromError(thrown: unknown): UncaughtState {
		return { caught: { thrown } };
	}

	override render() {
		const caught = this.state.caught;
		if (caught === undefined) {
			return this.props.children;
		}
		const error = caught.thrown;
		return (
			<ErrorNotice
				action={
					<Button onClick={this.props.onStartOver} size="xs" variant="outline">
						<RotateCcw /> Start over
					</Button>
				}
				caughtBy="the app's error boundary"
				type="unknown"
			>
				{Predicate.hasProperty(error, "message")
					? String(error.message)
					: String(error)}
			</ErrorNotice>
		);
	}
}

function DemoSkeleton() {
	return (
		<div className="grid gap-3">
			<Skeleton className="h-8 w-full" />
			<Skeleton className="h-24 w-full" />
		</div>
	);
}

/**
 * Keeps the trace recording for the whole session, whichever view is open:
 * the worker's server events, and the atoms' states.
 */
function TraceRecorder() {
	useAtomMount(serverEventsAtom);
	useAtomMount(atomTracksAtom);
	return null;
}

function Inspector(props: {
	readonly className?: string;
	readonly devtools: boolean;
}) {
	if (!props.devtools) {
		return (
			<div className={props.className}>
				<TracePanel />
			</div>
		);
	}
	return (
		<Tabs className={props.className} defaultValue="trace">
			<TabsList className="h-8">
				<TabsTrigger className="text-xs" value="trace">
					Trace
				</TabsTrigger>
				<TabsTrigger className="text-xs" value="queries">
					Queries
				</TabsTrigger>
				<TabsTrigger className="text-xs" value="devtools">
					Devtools
				</TabsTrigger>
			</TabsList>
			<TabsContent className="min-h-28" value="trace">
				<TracePanel />
			</TabsContent>
			<TabsContent className="min-h-28" value="queries">
				<QueriesPanel />
			</TabsContent>
			<TabsContent className="min-h-28" value="devtools">
				<Devtools />
			</TabsContent>
		</Tabs>
	);
}

/** The demo with the inspector beside it when the card is wide enough. */
function DemoCard(props: {
	/** Expand inline, Close in the dialog. */
	readonly action: ReactNode;
	readonly body: ReactNode;
	readonly className: string;
	readonly description: ReactNode;
	readonly devtools: boolean;
	readonly onStartOver: () => void;
	readonly title: ReactNode;
}) {
	return (
		<figure
			className={cn(
				"@container flex flex-col bg-card text-card-foreground",
				props.className,
			)}
		>
			<figcaption className="grid gap-3 border-b px-4 py-3">
				<div className="grid gap-1.5">
					<div className="flex items-center justify-between gap-3">
						{props.title}
						{props.action}
					</div>
					{props.description}
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<LatencyControl />
					<Button onClick={props.onStartOver} size="xs" variant="ghost">
						<RotateCcw /> Start over
					</Button>
				</div>
			</figcaption>
			<div className="grid min-h-0 flex-1 overflow-y-auto @3xl:grid-cols-[minmax(0,1fr)_26rem] @6xl:grid-cols-[minmax(0,1fr)_32rem]">
				<div className="min-w-0 p-4">{props.body}</div>
				<Inspector
					className="min-w-0 border-t bg-muted/30 px-4 py-3 @3xl:border-t-0 @3xl:border-l"
					devtools={props.devtools}
				/>
			</div>
		</figure>
	);
}

/**
 * A live demo in a box, with its own registry and its own RPC server in a
 * Web Worker. Beside it, the Queries panel shows its atoms and requests;
 * expanding it opens the same session with the devtools. Start over
 * disposes the registry, which stops the worker, and starts both afresh at
 * the same latency.
 */
export function DemoFrame(props: { readonly demo: DemoDefinition }) {
	const demo = props.demo;
	const [session, setSession] = useState(
		() => liveSessions.get(demo) ?? createSession(demo),
	);
	const [expanded, setExpanded] = useState(false);

	const startOver = () => {
		const controls = AsyncResult.value(session.registry.get(controlsAtom));
		const latency = Option.match(controls, {
			onNone: () => initialLatency,
			onSome: (value) => value.latency,
		});
		session.registry.dispose();
		const next = createSession(demo);
		if (latency !== initialLatency) {
			setLatency(next.registry, latency);
		}
		setSession(next);
	};

	const Demo = demo.Component;
	const body = (
		<UncaughtBoundary key={session.id} onStartOver={startOver}>
			<Suspense fallback={<DemoSkeleton />}>
				<Demo />
			</Suspense>
		</UncaughtBoundary>
	);
	const icon = (
		<FlaskConical className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
	);

	return (
		<RegistryContext.Provider value={session.registry}>
			<TraceRecorder key={session.id} />
			<DemoCard
				action={
					<Button
						onClick={() => {
							setExpanded(true);
						}}
						size="xs"
						variant="outline"
					>
						<Expand /> Expand
					</Button>
				}
				body={
					expanded ? (
						<p className="py-10 text-center text-sm text-muted-foreground">
							Running in the expanded view.
						</p>
					) : (
						body
					)
				}
				className="not-prose my-8 overflow-hidden rounded-xl border shadow-sm"
				description={
					<p className="text-xs text-muted-foreground">{demo.hint}</p>
				}
				devtools={false}
				onStartOver={startOver}
				title={
					<p className="flex items-center gap-2 text-sm font-semibold">
						{icon}
						{demo.title}
					</p>
				}
			/>
			<Dialog onOpenChange={setExpanded} open={expanded}>
				<DialogContent
					className="h-[min(56rem,92dvh)] w-[96vw] max-w-none gap-0 overflow-hidden p-0 sm:max-w-7xl"
					showCloseButton={false}
				>
					<DemoCard
						action={
							<Button
								onClick={() => {
									setExpanded(false);
								}}
								size="xs"
								variant="outline"
							>
								<Shrink /> Close
							</Button>
						}
						body={body}
						className="h-full min-h-0"
						description={
							<DialogDescription className="text-xs">
								{demo.hint}
							</DialogDescription>
						}
						devtools
						onStartOver={startOver}
						title={
							<DialogTitle className="flex items-center gap-2 text-sm">
								{icon}
								{demo.title}
							</DialogTitle>
						}
					/>
				</DialogContent>
			</Dialog>
		</RegistryContext.Provider>
	);
}
