import { useAtomValue } from "@effect/atom-react";
import { Button } from "@examples/ui/components/button";
import { Skeleton } from "@examples/ui/components/skeleton";
import { cn } from "@examples/ui/lib/utils";
import { IssueId } from "@examples/contract";
import {
	type AnyRoute,
	createRootRouteWithContext,
	createRoute,
	Outlet,
	useLoaderData,
	useRouterState,
} from "@tanstack/react-router";
import { AsyncResult, Atom } from "effect/reactivity";
import { type Handle, useAtomResult, useWaterfall } from "raf-effect-atom";
import { type ReactNode, Suspense, useState } from "react";

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

const strategies = ["loader", "render"] as const;
type Strategy = (typeof strategies)[number];

const parts = ["issue", "assignee", "comments"] as const;
type Part = (typeof parts)[number];

const procedures = {
	assignee: "GetIssueAssignee",
	comments: "ListComments",
	issue: "GetIssue",
} satisfies Record<Part, string>;

const startedIn = {
	loader:
		"loader: prefetch(issue, id), prefetch(assignee, id), prefetch(comments, id)",
	render: "no loader: each component calls useWaterfall(source, id)",
} satisfies Record<Strategy, string>;

/**
 * Each window's atoms, as `<procedure>:<strategy>:<id>`, so the windows
 * don't share results.
 */
function makeAtoms(strategy: Strategy) {
	function makeIssue(id: IssueId) {
		return IssuesClient.query(
			"GetIssue",
			{ id },
			{ serializationKey: `${strategy}:${id}` },
		);
	}
	function makeAssignee(issueId: IssueId) {
		return IssuesClient.query(
			"GetIssueAssignee",
			{ issueId },
			{ serializationKey: `${strategy}:${issueId}` },
		);
	}
	function makeComments(issueId: IssueId) {
		return IssuesClient.query(
			"ListComments",
			{ cursor: 0, issueId },
			{ serializationKey: `${strategy}:${issueId}` },
		);
	}
	return {
		assignee: Atom.family(makeAssignee),
		comments: Atom.family(makeComments),
		issue: Atom.family(makeIssue),
	};
}

type PageAtoms = ReturnType<typeof makeAtoms>;

const atomsFor = {
	loader: makeAtoms("loader"),
	render: makeAtoms("render"),
} satisfies Record<Strategy, PageAtoms>;

const loaderAtoms = atomsFor.loader;

/** The handles the loader strategy's route loader returns. */
interface LoaderHandles {
	readonly assignee: Handle<typeof loaderAtoms.assignee>;
	readonly comments: Handle<typeof loaderAtoms.comments>;
	readonly issue: Handle<typeof loaderAtoms.issue>;
}

/** The id in `/issues/<id>`. */
function idOf(pathname: string) {
	return IssueId.make(Number(pathname.split("/").at(-1)));
}

function Line(props: { readonly className: string; readonly label: string }) {
	return (
		<Skeleton
			aria-label={`Loading the ${props.label}`}
			className={props.className}
			role="status"
		/>
	);
}

function IssueTitle(props: { readonly issue: LoaderHandles["issue"] }) {
	const result = useAtomResult(loaderAtoms.issue, props.issue);
	if (AsyncResult.isFailure(result)) {
		return <IssueFailure caughtBy="the page" failure={result} />;
	}
	return (
		<h3 className="text-sm leading-snug font-semibold">{result.value.title}</h3>
	);
}

function AssigneeLine(props: { readonly assignee: LoaderHandles["assignee"] }) {
	const result = useAtomResult(loaderAtoms.assignee, props.assignee);
	if (AsyncResult.isFailure(result)) {
		return <IssueFailure caughtBy="the page" failure={result} />;
	}
	return (
		<p className="text-xs text-muted-foreground">
			Assigned to {result.value.name}
		</p>
	);
}

function CommentCount(props: { readonly comments: LoaderHandles["comments"] }) {
	const result = useAtomResult(loaderAtoms.comments, props.comments);
	if (AsyncResult.isFailure(result)) {
		return <IssueFailure caughtBy="the page" failure={result} />;
	}
	return (
		<p className="text-xs text-muted-foreground">
			{result.value.total} comments
		</p>
	);
}

/** The loader started all three, so each part fills in as its result lands. */
function LoaderPage(props: { readonly handles: LoaderHandles }) {
	return (
		<article className="grid gap-1.5">
			<Suspense fallback={<Line className="h-5 w-3/4" label="issue" />}>
				<IssueTitle issue={props.handles.issue} />
			</Suspense>
			<Suspense fallback={<Line className="h-3 w-1/2" label="assignee" />}>
				<AssigneeLine assignee={props.handles.assignee} />
			</Suspense>
			<Suspense fallback={<Line className="h-3 w-1/3" label="comments" />}>
				<CommentCount comments={props.handles.comments} />
			</Suspense>
		</article>
	);
}

/**
 * Each component starts its atom when it renders, through `useWaterfall`,
 * and renders its child only once its own result is in, so each request
 * waits for the one before.
 */
function RenderIssue(props: {
	readonly children: ReactNode;
	readonly id: IssueId;
}) {
	const source = atomsFor.render.issue;
	const result = useAtomResult(source, useWaterfall(source, props.id));
	if (AsyncResult.isFailure(result)) {
		return <IssueFailure caughtBy="the page" failure={result} />;
	}
	return (
		<>
			<h3 className="text-sm leading-snug font-semibold">
				{result.value.title}
			</h3>
			<Suspense
				fallback={
					<>
						<Line className="h-3 w-1/2" label="assignee" />
						<Line className="h-3 w-1/3" label="comments" />
					</>
				}
			>
				{props.children}
			</Suspense>
		</>
	);
}

function RenderAssignee(props: {
	readonly children: ReactNode;
	readonly id: IssueId;
}) {
	const source = atomsFor.render.assignee;
	const result = useAtomResult(source, useWaterfall(source, props.id));
	if (AsyncResult.isFailure(result)) {
		return <IssueFailure caughtBy="the page" failure={result} />;
	}
	return (
		<>
			<p className="text-xs text-muted-foreground">
				Assigned to {result.value.name}
			</p>
			<Suspense fallback={<Line className="h-3 w-1/3" label="comments" />}>
				{props.children}
			</Suspense>
		</>
	);
}

function RenderComments(props: { readonly id: IssueId }) {
	const source = atomsFor.render.comments;
	const result = useAtomResult(source, useWaterfall(source, props.id));
	if (AsyncResult.isFailure(result)) {
		return <IssueFailure caughtBy="the page" failure={result} />;
	}
	return (
		<p className="text-xs text-muted-foreground">
			{result.value.total} comments
		</p>
	);
}

function RenderPage(props: { readonly id: IssueId }) {
	return (
		<article className="grid gap-1.5">
			<Suspense
				fallback={
					<>
						<Line className="h-5 w-3/4" label="issue" />
						<Line className="h-3 w-1/2" label="assignee" />
						<Line className="h-3 w-1/3" label="comments" />
					</>
				}
			>
				<RenderIssue id={props.id}>
					<RenderAssignee id={props.id}>
						<RenderComments id={props.id} />
					</RenderAssignee>
				</RenderIssue>
			</Suspense>
		</article>
	);
}

function Home() {
	return <p className="text-sm text-muted-foreground">Open an issue above.</p>;
}

function IssueRoute() {
	// The route's typed hooks resolve through the docs site's registered
	// router, which doesn't have this route.
	const id = useRouterState({
		select: (state) => idOf(state.location.pathname),
	});
	// SAFETY: the issue route's loader returns `LoaderHandles`, or nothing
	// for the render strategy.
	const handles = useLoaderData({ strict: false }) as LoaderHandles | undefined;
	return handles === undefined ? (
		<RenderPage id={id} key={id} />
	) : (
		<LoaderPage handles={handles} key={id} />
	);
}

/** `/` and `/issues/$id`, whose atoms start where `strategy` says. */
function makeRouteTree(strategy: Strategy) {
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
		loader: (args): LoaderHandles | undefined => {
			if (strategy === "render") {
				return undefined;
			}
			const id = IssueId.make(Number(args.params.id));
			const atoms = args.context.atoms;
			return {
				assignee: atoms.prefetch(loaderAtoms.assignee, id),
				comments: atoms.prefetch(loaderAtoms.comments, id),
				issue: atoms.prefetch(loaderAtoms.issue, id),
			};
		},
		path: "/issues/$id",
	});
	return root.addChildren([home, issueRoute]);
}

const routeTrees = {
	loader: makeRouteTree("loader"),
	render: makeRouteTree("render"),
} satisfies Record<Strategy, AnyRoute>;

/** One atom's request in the latest navigation, in ms since the click. */
interface Bar {
	/** `undefined` while it's loading. */
	readonly end: number | undefined;
	readonly phase: AtomPhase | undefined;
	readonly start: number;
}

/** When `track` started loading after `since`, and when it settled. */
function barOf(track: AtomTrack | undefined, since: number): Bar | undefined {
	const segments = track?.segments ?? [];
	const start = segments.findIndex(
		(segment) =>
			segment.from >= since &&
			segment.phase.status === "initial" &&
			segment.waiting,
	);
	if (start === -1) {
		return undefined;
	}
	const settled = segments
		.slice(start)
		.find((segment) => segment.phase.status !== "initial" && !segment.waiting);
	return {
		end: settled === undefined ? undefined : settled.from - since,
		phase: settled?.phase,
		start: (segments[start]?.from ?? since) - since,
	};
}

interface Lane {
	readonly bars: Record<Part, Bar | undefined>;
	readonly startedAt: number;
}

function laneOf(
	strategy: Strategy,
	navigations: ReadonlyArray<Navigation>,
	tracks: ReadonlyArray<AtomTrack>,
): Lane | undefined {
	const navigation = navigations.findLast((each) =>
		each.href.startsWith("/issues/"),
	);
	if (navigation === undefined) {
		return undefined;
	}
	const id = idOf(navigation.href);
	const bar = (part: Part) =>
		barOf(
			tracks.findLast(
				(track) => track.label === `${procedures[part]}:${strategy}:${id}`,
			),
			navigation.startedAt,
		);
	return {
		bars: {
			assignee: bar("assignee"),
			comments: bar("comments"),
			issue: bar("issue"),
		},
		startedAt: navigation.startedAt,
	};
}

/** When the last of the lane's requests settled, if they all have. */
function doneAt(lane: Lane): number | undefined {
	let done = 0;
	for (const part of parts) {
		const end = lane.bars[part]?.end;
		if (end === undefined) {
			return undefined;
		}
		done = Math.max(done, end);
	}
	return done;
}

function RequestBar(props: {
	readonly bar: Bar | undefined;
	readonly running: number;
	readonly scale: number;
}) {
	const bar = props.bar;
	const percent = (ms: number) => `${Math.min(100, (ms / props.scale) * 100)}%`;
	return (
		<div aria-hidden className="relative h-3 rounded-sm bg-muted/60">
			{bar === undefined ? null : (
				<span
					className={cn(
						"absolute inset-y-0 rounded-sm",
						bar.phase === undefined
							? stateFill.waiting
							: stateFill[bar.phase.status],
					)}
					style={{
						left: percent(bar.start),
						width: percent(Math.max(0, (bar.end ?? props.running) - bar.start)),
					}}
				/>
			)}
		</div>
	);
}

function barText(bar: Bar | undefined) {
	if (bar === undefined) {
		return "not started";
	}
	if (bar.end === undefined) {
		return `started at ${formatMs(bar.start)}`;
	}
	return `${formatMs(bar.start)} – ${formatMs(bar.end)}`;
}

/**
 * Each window's requests on one clock from the click, like a browser's
 * network panel: when each atom started loading and when it settled.
 */
function RequestLanes() {
	const tracks = useAtomValue(atomTracksAtom);
	const loader = useAtomValue(navigationsAtom("loader"));
	const render = useAtomValue(navigationsAtom("render"));
	const now = useNow();
	const reducedMotion = useReducedMotion();
	const navigations = { loader, render } satisfies Record<
		Strategy,
		ReadonlyArray<Navigation>
	>;
	const lanes = strategies.map((strategy) => ({
		lane: laneOf(strategy, navigations[strategy], tracks),
		strategy,
	}));
	const longest = Math.max(
		...lanes.map(({ lane }) =>
			lane === undefined
				? 0
				: (doneAt(lane) ?? (reducedMotion ? 0 : now - lane.startedAt)),
		),
	);
	const scale = Math.ceil((Math.max(1000, longest) * 1.1) / 250) * 250;
	return (
		<section aria-label="Since the last click" className="grid gap-3">
			<div className="flex items-baseline justify-between text-xs">
				<h3 className="font-medium">Since the last click</h3>
				<span className="font-mono text-[11px] text-muted-foreground">
					0 – {formatMs(scale)}
				</span>
			</div>
			<div className="grid gap-4 @xl:grid-cols-2">
				{lanes.map((each) => {
					const lane = each.lane;
					const done = lane === undefined ? undefined : doneAt(lane);
					const running =
						lane === undefined
							? 0
							: reducedMotion
								? scale
								: now - lane.startedAt;
					return (
						<div className="grid gap-1.5" key={each.strategy}>
							<p className="flex justify-between gap-2 text-xs">
								<span className="font-medium">
									{each.strategy === "loader"
										? "Started in the loader"
										: "Started in render"}
								</span>
								<span className="font-mono text-[11px] text-muted-foreground">
									{lane === undefined
										? "not opened yet"
										: done === undefined
											? "loading"
											: `done at ${formatMs(done)}`}
								</span>
							</p>
							<ul className="grid gap-1">
								{parts.map((part) => {
									const bar = lane?.bars[part];
									return (
										<li
											className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-x-2"
											key={part}
										>
											<span className="font-mono text-[11px] text-muted-foreground">
												{part}
											</span>
											<RequestBar bar={bar} running={running} scale={scale} />
											<span className="sr-only">{barText(bar)}</span>
										</li>
									);
								})}
							</ul>
						</div>
					);
				})}
			</div>
		</section>
	);
}

const ids = [1, 2, 3].map((id) => IssueId.make(id));

function WaterfallsDemo() {
	const routers = {
		loader: useDemoRouter("loader", routeTrees.loader),
		render: useDemoRouter("render", routeTrees.render),
	};
	const [opened, setOpened] = useState<IssueId>();
	const open = (id: IssueId) => {
		setOpened(id);
		for (const strategy of strategies) {
			void routers[strategy].navigate({ href: `/issues/${id}` });
		}
	};
	return (
		<div className="@container grid gap-4">
			<div className="flex flex-wrap items-center gap-1.5">
				<span className="text-xs text-muted-foreground">In both:</span>
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
			<div className="grid gap-3 @xl:grid-cols-2">
				{strategies.map((strategy) => (
					<BrowserWindow
						header={
							<p className="border-b px-2 py-1.5 font-mono text-[11px] leading-snug">
								{startedIn[strategy]}
							</p>
						}
						key={strategy}
						router={routers[strategy]}
					/>
				))}
			</div>
			<RequestLanes />
		</div>
	);
}

export default defineDemo({
	Component: WaterfallsDemo,
	hint: "Open an issue. The loader starts its three atoms together, so the page is done after the slowest one. Started in render, each request waits for the component above it to get its data first.",
	title: "One round trip or three",
});
