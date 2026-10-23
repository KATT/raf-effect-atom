import { useAtomValue } from "@effect/atom-react";
import { Button } from "@examples/ui/components/button";
import { Skeleton } from "@examples/ui/components/skeleton";
import { cn } from "@examples/ui/lib/utils";
import { IssueId } from "@examples/contract";
import {
	createRootRouteWithContext,
	createRoute,
	type AnyRoute,
	Outlet,
	useLoaderData,
} from "@tanstack/react-router";
import { AsyncResult, Atom } from "effect/reactivity";
import { type Handle, useAtomResult } from "raf-effect-atom";
import { Suspense, useState } from "react";

import { IssuesClient } from "~/demo-kit/client.ts";
import { defineDemo } from "~/demo-kit/define.ts";
import { IssueFailure } from "~/demo-kit/issue-failure.tsx";
import { useNow, useReducedMotion } from "~/demo-kit/now.ts";
import {
	BrowserWindow,
	type DemoRouterContext,
	type Navigation,
	navigationsAtom,
	useDemoRouter,
} from "~/demo-kit/router.tsx";
import { formatMs, stateFill } from "~/demo-kit/state.tsx";
import {
	type AtomPhase,
	type AtomTrack,
	atomTracksAtom,
} from "~/demo-kit/trace.ts";

const verbs = ["prefetch", "ensure", "fetch"] as const;
type Verb = (typeof verbs)[number];

const loaderCode = {
	ensure: "await atoms.ensure(issue, id)",
	fetch: "await atoms.fetch(issue, id)",
	prefetch: "atoms.prefetch(issue, id)",
} satisfies Record<Verb, string>;

/**
 * Each window's issues, as `GetIssue:<verb>:<id>`, so the windows don't
 * share results. An issue stays for a minute after its page stops reading
 * it, so opening it again finds it in the registry.
 */
function makeIssues(verb: Verb) {
	function makeIssue(id: IssueId) {
		return IssuesClient.query(
			"GetIssue",
			{ id },
			{ serializationKey: `${verb}:${id}`, timeToLive: "1 minute" },
		);
	}
	return Atom.family(makeIssue);
}

const issueFor = Atom.family(makeIssues);

/** The id in `/issues/<id>`. */
function idOf(pathname: string) {
	return IssueId.make(Number(pathname.split("/").at(-1)));
}

function Home() {
	return <p className="text-sm text-muted-foreground">Open an issue above.</p>;
}

function IssueSkeleton() {
	return (
		<div aria-label="Loading the issue" className="grid gap-2" role="status">
			<Skeleton className="h-3 w-10" />
			<Skeleton className="h-5 w-3/4" />
			<Skeleton className="h-3 w-full" />
		</div>
	);
}

type IssueSource = ReturnType<typeof issueFor>;

function IssueContent(props: {
	readonly issue: Handle<IssueSource>;
	readonly source: IssueSource;
}) {
	const result = useAtomResult(props.source, props.issue);
	if (AsyncResult.isFailure(result)) {
		return <IssueFailure caughtBy="the page" failure={result} />;
	}
	const issue = result.value;
	return (
		<article className="grid gap-1">
			<p className="font-mono text-xs text-muted-foreground">#{issue.id}</p>
			<h3 className="text-sm leading-snug font-semibold">{issue.title}</h3>
			<p className="line-clamp-2 text-xs text-muted-foreground">{issue.body}</p>
		</article>
	);
}

/** What the issue route's loader returns: the issue's handle. */
interface IssueData {
	readonly issue: Handle<IssueSource>;
}

/** `/` and `/issues/$id`, whose loader starts the issue with `verb`. */
function makeRouteTree(verb: Verb) {
	const root = createRootRouteWithContext<DemoRouterContext>()({
		component: Outlet,
	});
	const home = createRoute({
		component: Home,
		getParentRoute: () => root,
		path: "/",
	});
	const issueRoute = createRoute({
		component: IssueRoute,
		getParentRoute: () => root,
		loader: async (args): Promise<IssueData> => {
			const atoms = args.context.atoms;
			const source = issueFor(verb);
			const id = IssueId.make(Number(args.params.id));
			switch (verb) {
				case "ensure": {
					return { issue: await atoms.ensure(source, id) };
				}
				case "fetch": {
					return { issue: await atoms.fetch(source, id) };
				}
				case "prefetch": {
					return { issue: atoms.prefetch(source, id) };
				}
			}
		},
		path: "/issues/$id",
	});
	function IssueRoute() {
		// SAFETY: the issue route's loader returns `IssueData`. The route's
		// typed hooks resolve through the docs site's registered router, which
		// doesn't have this route.
		const data = useLoaderData({ strict: false }) as IssueData;
		return (
			<Suspense fallback={<IssueSkeleton />} key={data.issue.key}>
				<IssueContent issue={data.issue} source={issueFor(verb)} />
			</Suspense>
		);
	}
	return root.addChildren([home, issueRoute]);
}

const routeTrees = {
	ensure: makeRouteTree("ensure"),
	fetch: makeRouteTree("fetch"),
	prefetch: makeRouteTree("prefetch"),
} satisfies Record<Verb, AnyRoute>;

/** When the page first showed the issue: the page renders at `resolvedAt`, then shows the atom's result once it has one. */
function issueShownAt(
	track: AtomTrack | undefined,
	resolvedAt: number,
): { readonly at: number; readonly phase: AtomPhase } | undefined {
	for (const segment of track?.segments ?? []) {
		const shown =
			segment.phase.status !== "initial" &&
			!(segment.waiting && segment.phase.status === "failure");
		if (shown && (segment.to === undefined || segment.to > resolvedAt)) {
			return { at: Math.max(segment.from, resolvedAt), phase: segment.phase };
		}
	}
	return undefined;
}

/** A verb's latest navigation to an issue, in ms since it started. */
interface Lane {
	/** `undefined` until the page shows the issue. */
	readonly issue:
		| { readonly ms: number; readonly phase: AtomPhase }
		| undefined;
	/** `undefined` while the navigation waits for its loader. */
	readonly pageMs: number | undefined;
	readonly startedAt: number;
}

function laneOf(
	verb: Verb,
	navigations: ReadonlyArray<Navigation>,
	tracks: ReadonlyArray<AtomTrack>,
): Lane | undefined {
	const navigation = navigations.findLast((each) =>
		each.href.startsWith("/issues/"),
	);
	if (navigation === undefined) {
		return undefined;
	}
	const { resolvedAt, startedAt } = navigation;
	if (resolvedAt === undefined) {
		return { issue: undefined, pageMs: undefined, startedAt };
	}
	const id = idOf(navigation.href);
	const track = tracks.findLast(
		(each) => each.label === `GetIssue:${verb}:${id}`,
	);
	const shown = issueShownAt(track, resolvedAt);
	return {
		issue:
			shown === undefined
				? undefined
				: { ms: shown.at - startedAt, phase: shown.phase },
		pageMs: resolvedAt - startedAt,
		startedAt,
	};
}

/** Below this, a wait isn't one a reader would notice. */
const instantMs = 50;

function laneText(lane: Lane, elapsed: number) {
	const page =
		lane.pageMs === undefined
			? `blocked · ${formatMs(elapsed)}`
			: lane.pageMs < instantMs
				? "rendered at once"
				: `blocked ${formatMs(lane.pageMs)}`;
	const issue =
		lane.pageMs === undefined
			? "waits for the page"
			: lane.issue === undefined
				? `streaming · ${formatMs(elapsed)}`
				: lane.issue.ms - lane.pageMs < instantMs
					? "with the page"
					: `streamed in at ${formatMs(lane.issue.ms)}`;
	return { issue, page };
}

function LaneBar(props: {
	readonly lane: Lane;
	readonly now: number;
	readonly reducedMotion: boolean;
	readonly scale: number;
}) {
	const lane = props.lane;
	// Under reduced motion, what's still running fills the lane instead of
	// growing with the clock.
	const running = props.reducedMotion
		? props.scale
		: props.now - lane.startedAt;
	const pageEnd = lane.pageMs ?? running;
	const issueEnd = lane.issue?.ms ?? (lane.pageMs === undefined ? 0 : running);
	const percent = (ms: number) => `${Math.min(100, (ms / props.scale) * 100)}%`;
	return (
		<div aria-hidden className="relative h-4 rounded-sm bg-muted/60">
			<span
				className={cn(
					"absolute inset-y-0 left-0 rounded-l-sm",
					stateFill.waiting,
				)}
				style={{ width: percent(pageEnd) }}
			/>
			{lane.pageMs === undefined ? null : (
				<span
					className="absolute inset-y-0 bg-state-initial/40"
					style={{
						left: percent(lane.pageMs),
						width: percent(Math.max(0, issueEnd - lane.pageMs)),
					}}
				/>
			)}
			{lane.issue === undefined ? null : (
				<span
					className={cn(
						"absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-background",
						stateFill[lane.issue.phase.status],
					)}
					style={{ left: percent(lane.issue.ms) }}
				/>
			)}
		</div>
	);
}

function Swatch(props: { readonly className: string }) {
	return (
		<span
			aria-hidden
			className={cn("inline-block h-2.5 w-4 rounded-xs", props.className)}
		/>
	);
}

/**
 * Each window's latest navigation on one clock from the click: how long
 * the router kept the old page while its loader waited (striped), how long
 * the new page showed a skeleton while the issue streamed in (grey), and
 * when the issue appeared (the dot).
 */
function VerbLanes() {
	const tracks = useAtomValue(atomTracksAtom);
	const ensure = useAtomValue(navigationsAtom("ensure"));
	const fetch = useAtomValue(navigationsAtom("fetch"));
	const prefetch = useAtomValue(navigationsAtom("prefetch"));
	const now = useNow();
	const reducedMotion = useReducedMotion();
	const navigations = { ensure, fetch, prefetch } satisfies Record<
		Verb,
		ReadonlyArray<Navigation>
	>;
	const lanes = verbs.map((verb) => ({
		lane: laneOf(verb, navigations[verb], tracks),
		verb,
	}));
	const longest = Math.max(
		...lanes.map(({ lane }) =>
			lane === undefined
				? 0
				: (lane.issue?.ms ??
					(reducedMotion ? (lane.pageMs ?? 0) : now - lane.startedAt)),
		),
	);
	const scale = Math.ceil((Math.max(1000, longest) * 1.1) / 250) * 250;

	return (
		<section aria-label="Since the last click" className="grid gap-2.5">
			<div className="flex items-baseline justify-between text-xs">
				<h3 className="font-medium">Since the last click</h3>
				<span className="font-mono text-[11px] text-muted-foreground">
					0 – {formatMs(scale)}
				</span>
			</div>
			<ul className="grid gap-2.5">
				{lanes.map((each) => {
					const lane = each.lane;
					const text =
						lane === undefined
							? undefined
							: laneText(lane, now - lane.startedAt);
					return (
						<li
							className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-start gap-x-3 gap-y-1"
							key={each.verb}
						>
							<code className="pt-0.5 font-mono text-xs font-semibold">
								{each.verb}
							</code>
							<div className="grid gap-1">
								{lane === undefined ? (
									<div aria-hidden className="h-4 rounded-sm bg-muted/60" />
								) : (
									<LaneBar
										lane={lane}
										now={now}
										reducedMotion={reducedMotion}
										scale={scale}
									/>
								)}
								<p className="flex flex-wrap gap-x-3 font-mono text-[11px] text-muted-foreground">
									{text === undefined ? (
										"not opened yet"
									) : (
										<>
											<span>page: {text.page}</span>
											<span>issue: {text.issue}</span>
										</>
									)}
								</p>
							</div>
						</li>
					);
				})}
			</ul>
			<p className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
				<span className="flex items-center gap-1.5">
					<Swatch className={stateFill.waiting} /> navigation blocked, the old
					page stays
				</span>
				<span className="flex items-center gap-1.5">
					<Swatch className="bg-state-initial/40" /> page rendered, the issue
					streams in
				</span>
				<span className="flex items-center gap-1.5">
					<span
						aria-hidden
						className="size-2.5 rounded-full bg-state-success"
					/>{" "}
					issue on screen
				</span>
			</p>
		</section>
	);
}

const ids = [1, 2, 3].map((id) => IssueId.make(id));

function LoaderVerbsDemo() {
	const routers = {
		ensure: useDemoRouter("ensure", routeTrees.ensure),
		fetch: useDemoRouter("fetch", routeTrees.fetch),
		prefetch: useDemoRouter("prefetch", routeTrees.prefetch),
	};
	const [opened, setOpened] = useState<IssueId>();
	const open = (id: IssueId) => {
		setOpened(id);
		for (const verb of verbs) {
			void routers[verb].navigate({ href: `/issues/${id}` });
		}
	};
	return (
		<div className="@container grid gap-4">
			<div className="flex flex-wrap items-center gap-1.5">
				<span className="text-xs text-muted-foreground">In all three:</span>
				{ids.map((id) => (
					<Button
						aria-pressed={id === opened}
						key={id}
						onClick={() => {
							open(id);
						}}
						size="xs"
						variant={id === opened ? "secondary" : "ghost"}
					>
						Open issue #{id}
					</Button>
				))}
			</div>
			<div className="grid gap-3 @xl:grid-cols-3">
				{verbs.map((verb) => (
					<BrowserWindow
						header={
							<p className="border-b px-2 py-1.5 font-mono text-[11px] leading-snug">
								<span className="text-muted-foreground">loader: </span>
								{loaderCode[verb]}
							</p>
						}
						key={verb}
						router={routers[verb]}
					/>
				))}
			</div>
			<VerbLanes />
		</div>
	);
}

export default defineDemo({
	Component: LoaderVerbsDemo,
	hint: "Open an issue, then another, then the first again. prefetch renders the page at once and streams the issue in; ensure blocks the navigation the first time only; fetch blocks it every time, to refresh.",
	title: "prefetch, ensure and fetch",
});
