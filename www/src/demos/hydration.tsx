import { RegistryContext, useAtomSet, useAtomValue } from "@effect/atom-react";
import { Button } from "@examples/ui/components/button";
import { Skeleton } from "@examples/ui/components/skeleton";
import { cn } from "@examples/ui/lib/utils";
import { IssueId } from "@examples/contract";
import { Option } from "effect";
import {
	AsyncResult,
	Atom,
	Hydration as AtomHydration,
	type AtomRegistry,
} from "effect/reactivity";
import { ArrowDown, Globe, Server } from "lucide-react";
import {
	Hydration,
	Loader,
	RequestRegistry,
	useAtomResult,
} from "raf-effect-atom";
import { type ReactNode, Suspense } from "react";

import { AtomNodes } from "~/demo-kit/atom-nodes.tsx";
import {
	controlsAtom,
	IssuesClient,
	serverEventsAtom,
	setLatency,
} from "~/demo-kit/client.ts";
import { IssueFailure } from "~/demo-kit/issue-failure.tsx";
import { defineDemo } from "~/demo-kit/define.ts";
import { useNow } from "~/demo-kit/now.ts";
import {
	formatMs,
	phaseText,
	stateFill,
	stateTint,
} from "~/demo-kit/state.tsx";
import {
	type AtomPhase,
	atomTracksAtom,
	phaseOf,
	requestsAtom,
	type TracedRequest,
} from "~/demo-kit/trace.ts";
import { Wire } from "~/demo-kit/wire.tsx";

const id = IssueId.make(1);

/**
 * The page's atoms for one page load, as `GetIssue:1, load <n>`: each load
 * is a fresh request, so it gets fresh atoms in the browser too.
 */
function pageAtoms(load: number) {
	const serializationKey = `${id}, load ${load}`;
	return {
		assignee: IssuesClient.query(
			"GetIssueAssignee",
			{ issueId: id },
			{ serializationKey },
		),
		issue: IssuesClient.query("GetIssue", { id }, { serializationKey }),
	};
}

/** One serializable atom in the server's dehydrated state. */
interface Sent {
	/** When its streamed result reached the browser; `undefined` for a value sent with the page, or one still on its way. */
	readonly arrivedAt: number | undefined;
	readonly key: string;
	readonly phase: AtomPhase;
	/** Sent as a promise, because it was still loading when the loaders finished. */
	readonly streamed: boolean;
}

interface PageLoad {
	readonly error: string | undefined;
	readonly hydrate: boolean;
	readonly load: number;
	/** The server's registry for this request. */
	readonly registry: AtomRegistry.AtomRegistry;
	/** Once the loaders finished: the page and its dehydrated state went out. */
	readonly sent: ReadonlyArray<Sent> | undefined;
	readonly sentAt: number | undefined;
	readonly startedAt: number;
}

const keyOf = (atom: Atom.Atom<unknown>) =>
	Atom.isSerializable(atom) ? atom[Atom.SerializableTypeId].key : undefined;

/**
 * A request for the page, served in the browser: a request registry, with
 * its own worker as its RPC server, runs the route's loaders, then its
 * dehydrated state goes to the page's registry, through
 * `Hydration.hydrate` unless `hydrate` is false. The registry is disposed
 * when nothing reads the load any more, such as when the next one starts.
 */
function makePageLoad(load: number, hydrate: boolean) {
	return Atom.make((get): PageLoad => {
		const browser = get.registry;
		const server = RequestRegistry.make();
		let disposed = false;
		get.addFinalizer(() => {
			disposed = true;
			server.dispose();
		});
		// Traced like the demo's own registry, for the server's panel.
		server.mount(serverEventsAtom);
		server.mount(atomTracksAtom);
		const latency = Option.map(
			AsyncResult.value(browser.get(controlsAtom)),
			(controls) => controls.latency,
		);
		if (Option.isSome(latency)) {
			setLatency(server, latency.value);
		}
		let current: PageLoad = {
			error: undefined,
			hydrate,
			load,
			registry: server,
			sent: undefined,
			sentAt: undefined,
			startedAt: Date.now(),
		};
		const update = (f: (state: PageLoad) => PageLoad) => {
			if (!disposed) {
				current = f(current);
				get.setSelf(current);
			}
		};

		const atoms = Loader.make(server);
		const page = pageAtoms(load);
		atoms.prefetch(page.assignee);
		atoms.ensure(page.issue).then(
			() => {
				if (disposed) {
					return;
				}
				const state = Hydration.dehydrate(server);
				const streamed = new Set(
					AtomHydration.toValues(state).flatMap((value) =>
						value.resultPromise === undefined ? [] : [value.key],
					),
				);
				if (hydrate) {
					Hydration.hydrate(browser, state);
				}
				const sentAt = Date.now();
				const phases = () =>
					[
						{ atom: page.issue, phase: phaseOf(server.get(page.issue)) },
						{
							atom: page.assignee,
							phase: phaseOf(server.get(page.assignee)),
						},
					].map((entry) => ({
						key: keyOf(entry.atom) ?? String(entry.atom),
						phase: entry.phase,
					}));
				update((each) => ({
					...each,
					sent: phases().map((entry) => ({
						arrivedAt: undefined,
						key: entry.key.replace(/^AtomRpc:/, ""),
						phase: entry.phase,
						streamed: streamed.has(entry.key),
					})),
					sentAt,
				}));
				// Each streamed result reaches the browser when its atom settles on
				// the server.
				server.subscribe(page.assignee, () => {
					const arrivedAt = Date.now();
					const now = new Map(
						phases().map((entry) => [
							entry.key.replace(/^AtomRpc:/, ""),
							entry.phase,
						]),
					);
					update((each) => ({
						...each,
						sent: each.sent?.map((entry) => {
							const phase = now.get(entry.key) ?? entry.phase;
							return entry.streamed &&
								entry.arrivedAt === undefined &&
								phase.status !== "initial"
								? { ...entry, arrivedAt, phase }
								: entry;
						}),
					}));
				});
			},
			() => {
				update((each) => ({ ...each, error: "The loaders died." }));
			},
		);
		return current;
	}).pipe(Atom.withLabel(`demo-kit:page-load:${load}`));
}

function makeHydratedLoad(load: number) {
	return makePageLoad(load, true);
}

function makeUnhydratedLoad(load: number) {
	return makePageLoad(load, false);
}

const hydratedLoad = Atom.family(makeHydratedLoad);
const unhydratedLoad = Atom.family(makeUnhydratedLoad);

/** The latest page load, kept across the inline and expanded views. */
const currentLoadAtom = Atom.make<
	{ readonly hydrate: boolean; readonly load: number } | undefined
>(undefined).pipe(Atom.keepAlive, Atom.withLabel("demo-kit:current-load"));

function Panel(props: {
	readonly children: ReactNode;
	readonly icon: ReactNode;
	readonly title: string;
}) {
	return (
		<section
			aria-label={props.title}
			className="grid gap-2.5 rounded-lg border bg-background p-3"
		>
			<h3 className="flex items-center gap-1.5 text-xs font-medium">
				{props.icon}
				{props.title}
			</h3>
			{props.children}
		</section>
	);
}

function Connector(props: {
	readonly children: ReactNode;
	readonly code: string;
}) {
	return (
		<div className="grid justify-items-center gap-1.5 py-1">
			<ArrowDown aria-hidden className="size-4 text-muted-foreground" />
			<code className="font-mono text-[11px]">{props.code}</code>
			{props.children}
		</div>
	);
}

function countOf(requests: ReadonlyArray<TracedRequest>, since: number) {
	return requests.filter(
		(request) =>
			request.sentAt >= since && request.label.startsWith("GetIssue"),
	).length;
}

function RequestCount(props: {
	readonly count: number;
	readonly from: string;
	readonly repeated?: boolean;
}) {
	return (
		<p
			className={cn(
				"justify-self-start rounded px-2 py-1 font-mono text-[11px] ring-1 ring-inset",
				props.repeated === true ? stateTint.failure : stateTint.success,
			)}
		>
			{props.count} {props.count === 1 ? "request" : "requests"} from{" "}
			{props.from}
			{props.repeated === true ? ": everything again" : ""}
		</p>
	);
}

/** The server's registry: its atoms and its requests to its own worker. */
function ServerTrace(props: { readonly startedAt: number }) {
	const tracks = useAtomValue(atomTracksAtom);
	const requests = useAtomValue(requestsAtom);
	const now = useNow();
	return (
		<>
			<AtomNodes now={now} tracks={tracks} />
			<Wire now={now} requests={requests} />
			<RequestCount
				count={countOf(requests, props.startedAt)}
				from="the server"
			/>
		</>
	);
}

function SentEntry(props: {
	readonly entry: Sent;
	readonly now: number;
	readonly sentAt: number;
}) {
	const entry = props.entry;
	const settled = entry.phase.status !== "initial";
	const state = settled ? entry.phase.status : "waiting";
	return (
		<li className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-md border bg-background px-2 py-1.5 font-mono text-[11px] motion-safe:transition-[translate,opacity] motion-safe:duration-500 motion-safe:starting:-translate-y-2 motion-safe:starting:opacity-0">
			<span className="truncate">{entry.key}</span>
			<span className="flex items-center gap-1.5">
				<span
					className={cn(
						"inline-flex items-center gap-1 rounded px-1.5 py-0.5 ring-1 ring-inset",
						stateTint[state],
					)}
				>
					<span
						aria-hidden
						className={cn("size-1.5 rounded-full", stateFill[state])}
					/>
					{entry.streamed
						? settled
							? `promise → ${phaseText(entry.phase)}`
							: "promise"
						: phaseText(entry.phase)}
				</span>
				<span className="text-muted-foreground">
					{entry.streamed
						? entry.arrivedAt === undefined
							? `streaming · ${formatMs(props.now - props.sentAt)}`
							: `streamed +${formatMs(entry.arrivedAt - props.sentAt)}`
						: "with the page"}
				</span>
			</span>
		</li>
	);
}

function SentState(props: { readonly load: PageLoad }) {
	const now = useNow();
	const sent = props.load.sent;
	const sentAt = props.load.sentAt;
	if (sent === undefined || sentAt === undefined) {
		return (
			<p className="text-center text-xs text-muted-foreground">
				{props.load.error ?? "Waiting for the server’s loaders…"}
			</p>
		);
	}
	return (
		<ul aria-label="Dehydrated atoms" className="grid w-full gap-1.5">
			{sent.map((entry) => (
				<SentEntry entry={entry} key={entry.key} now={now} sentAt={sentAt} />
			))}
		</ul>
	);
}

function IssueHeading(props: { readonly load: number }) {
	const result = useAtomResult(pageAtoms(props.load).issue);
	if (AsyncResult.isFailure(result)) {
		return <IssueFailure caughtBy="the page" failure={result} />;
	}
	return (
		<div className="grid gap-0.5">
			<p className="font-mono text-xs text-muted-foreground">
				#{result.value.id}
			</p>
			<p className="text-sm font-semibold">{result.value.title}</p>
		</div>
	);
}

function Assignee(props: { readonly load: number }) {
	const result = useAtomResult(pageAtoms(props.load).assignee);
	if (AsyncResult.isFailure(result)) {
		return <IssueFailure caughtBy="the assignee" failure={result} />;
	}
	return (
		<p className="text-xs text-muted-foreground">
			Assigned to{" "}
			<span className="font-medium text-foreground">{result.value.name}</span>
		</p>
	);
}

function BrowserPage(props: { readonly load: PageLoad }) {
	const requests = useAtomValue(requestsAtom);
	const sentAt = props.load.sentAt;
	if (sentAt === undefined) {
		return (
			<p className="text-xs text-muted-foreground">
				Waiting for the page’s HTML…
			</p>
		);
	}
	const count = countOf(requests, sentAt);
	return (
		<>
			<div className="grid gap-2 rounded-md border p-3">
				<Suspense fallback={<Skeleton className="h-9 w-3/4" />}>
					<IssueHeading load={props.load.load} />
				</Suspense>
				<Suspense fallback={<Skeleton className="h-4 w-1/2" />}>
					<Assignee load={props.load.load} />
				</Suspense>
			</div>
			<RequestCount count={count} from="the browser" repeated={count > 0} />
		</>
	);
}

function PageLoadView(props: {
	readonly hydrate: boolean;
	readonly load: number;
}) {
	const pageLoad = useAtomValue(
		(props.hydrate ? hydratedLoad : unhydratedLoad)(props.load),
	);
	return (
		<div className="grid">
			<Panel
				icon={<Server aria-hidden className="size-3.5" />}
				title="Server: the request’s registry"
			>
				<pre className="font-mono text-[11px] leading-relaxed text-muted-foreground">
					{"atoms.prefetch(assignee(1))\nawait atoms.ensure(issue(1))"}
				</pre>
				<RegistryContext.Provider value={pageLoad.registry}>
					<ServerTrace startedAt={pageLoad.startedAt} />
				</RegistryContext.Provider>
			</Panel>
			<Connector code="Hydration.dehydrate(registry)">
				<SentState load={pageLoad} />
			</Connector>
			<Connector
				code={
					pageLoad.hydrate
						? "Hydration.hydrate(registry, state)"
						: "// not hydrated"
				}
			>
				{null}
			</Connector>
			<Panel
				icon={<Globe aria-hidden className="size-3.5" />}
				title="Browser: the page’s registry"
			>
				<BrowserPage load={pageLoad} />
			</Panel>
		</div>
	);
}

function HydrationDemo() {
	const current = useAtomValue(currentLoadAtom);
	const setCurrent = useAtomSet(currentLoadAtom);
	const start = (hydrate: boolean) => {
		setCurrent({ hydrate, load: (current?.load ?? 0) + 1 });
	};
	return (
		<div className="grid gap-4">
			<div className="flex flex-wrap gap-2">
				<Button
					onClick={() => {
						start(true);
					}}
					size="xs"
					variant="outline"
				>
					Load the page
				</Button>
				<Button
					onClick={() => {
						start(false);
					}}
					size="xs"
					variant="ghost"
				>
					Load it without hydrating
				</Button>
			</div>
			{current === undefined ? (
				<p className="rounded-md border border-dashed py-6 text-center text-xs text-muted-foreground">
					Load the page to send a request to the server.
				</p>
			) : (
				<PageLoadView
					hydrate={current.hydrate}
					key={current.load}
					load={current.load}
				/>
			)}
		</div>
	);
}

export default defineDemo({
	Component: HydrationDemo,
	hint: "Load the page: the server’s loaders fetch the issue and start its assignee, the issue crosses with the page and the assignee streams in after it, and the browser sends no request. Load it without hydrating to see it ask for everything again.",
	title: "Server results, hydrated",
});
