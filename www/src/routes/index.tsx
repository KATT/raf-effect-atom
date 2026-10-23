import { Badge } from "@examples/ui/components/badge";
import { buttonVariants } from "@examples/ui/components/button";
import { cn } from "@examples/ui/lib/utils";
import {
	createFileRoute,
	Link,
	stripSearchParams,
} from "@tanstack/react-router";
import {
	ArrowRight,
	Layers,
	Route as RouteIcon,
	ShieldCheck,
	Sparkles,
	Waves,
	Workflow,
} from "lucide-react";
import type { ReactNode } from "react";
import boundariesNext from "sample:nextjs/src/boundaries.tsx#issue";
import componentNext from "sample:nextjs/src/components/issue-page.tsx#component";
import layoutNext from "sample:nextjs/src/app/layout.tsx#layout";
import pageNext from "sample:nextjs/src/app/issues/[id]/page.tsx#page";
import clientNext from "sample:nextjs/src/issues-client.ts#client";
import atomsNext from "sample:nextjs/src/issues.ts#atoms";
import contextRouter from "sample:react-router/app/atoms.ts#context";
import boundariesRouter from "sample:react-router/app/boundaries.tsx#issue";
import clientRouter from "sample:react-router/app/issues-client.ts#client";
import atomsRouter from "sample:react-router/app/issues.ts#atoms";
import rootRouter from "sample:react-router/app/root.tsx#root";
import componentRouter from "sample:react-router/app/routes/issues.$id.tsx#component";
import heroRouter from "sample:react-router/app/routes/issues.$id.tsx#hero";
import loaderRouter from "sample:react-router/app/routes/issues.$id.tsx#loader";
import boundariesStart from "sample:tanstack-start/src/boundaries.tsx#issue";
import fetchInRender from "sample:tanstack-start/src/docs/coding-agents.tsx#fetch-in-render";
import forgottenTag from "sample:tanstack-start/src/docs/coding-agents.tsx#forgotten-tag";
import misspelledTag from "sample:tanstack-start/src/docs/error-boundaries.tsx#misspelled";
import clientStart from "sample:tanstack-start/src/issues-client.ts#client";
import atomsStart from "sample:tanstack-start/src/issues.ts#atoms";
import routerStart from "sample:tanstack-start/src/router.tsx#router";
import rootStart from "sample:tanstack-start/src/routes/__root.tsx#root";
import componentStart from "sample:tanstack-start/src/routes/issues.$id.tsx#component";
import heroStart from "sample:tanstack-start/src/routes/issues.$id.tsx#hero";
import routeStart from "sample:tanstack-start/src/routes/issues.$id.tsx#route";

import { DocBody } from "~/components/doc-body.tsx";
import { FrameworkModeBar } from "~/components/framework-mode-bar.tsx";
import type { DocSegment, Sample } from "~/content/types.ts";
import {
	defaultFrameworkMode,
	type FrameworkMode,
	frameworkModes,
	homeSearchDefaults,
	homeSearchSchema,
	syncFrameworkModeAttribute,
} from "~/framework-mode.ts";
import { pageHead } from "~/seo.ts";
import { site } from "~/site.ts";

export const Route = createFileRoute("/")({
	validateSearch: homeSearchSchema,
	search: {
		middlewares: [stripSearchParams(homeSearchDefaults)],
	},
	head: () =>
		pageHead({
			description: site.description,
			markdownPath: "/llms.txt",
			path: "/",
			structuredData: [
				{
					"@type": "WebSite",
					description: site.description,
					name: site.name,
					url: site.url,
				},
				{
					"@type": "SoftwareSourceCode",
					codeRepository: site.github,
					description: site.description,
					license: "https://opensource.org/licenses/MIT",
					name: site.name,
					programmingLanguage: ["TypeScript", "React"],
					runtimePlatform: "Node.js, browsers",
					url: site.url,
				},
			],
		}),
	component: HomePage,
});

const packages: ReadonlyArray<{
	readonly body: ReactNode;
	readonly install: string;
	readonly name: string;
	readonly slug: string;
}> = [
	{
		body: "Error boundaries typed by an atom's error. Catch failures by _tag, with a handler per tag typed by the error with that tag. Works with plain @effect/atom-react.",
		install: "pnpm add effect-atom-boundary",
		name: "effect-atom-boundary",
		slug: "error-boundaries",
	},
	{
		body: "Start atoms from route loaders with prefetch, ensure or fetch, stream them into the browser's registry with their typed failures, and read them under Suspense.",
		install: "pnpm add raf-effect-atom",
		name: "raf-effect-atom",
		slug: "loader-verbs",
	},
];

const features: ReadonlyArray<{
	readonly body: string;
	readonly icon: ReactNode;
	readonly slug: string;
	readonly title: string;
}> = [
	{
		body: "Loaders start every atom a page needs at the same time, before anything renders.",
		icon: <RouteIcon />,
		slug: "request-waterfalls",
		title: "No waterfalls",
	},
	{
		body: "Results still loading cross as promises; the browser waits for them instead of asking again.",
		icon: <Waves />,
		slug: "hydration",
		title: "Streamed, not refetched",
	},
	{
		body: "A server-side IssueNotFound is an IssueNotFound in the browser, decoded by the procedure's Schema.",
		icon: <ShieldCheck />,
		slug: "loader-failures",
		title: "Typed failures survive",
	},
	{
		body: "catchTags keys come from the atom's error type. A misspelled tag is a compile error.",
		icon: <Sparkles />,
		slug: "error-boundaries",
		title: "Boundaries infer their errors",
	},
	{
		body: "A shared boundary claims app-wide failures, and reads under it are typed without them.",
		icon: <Layers />,
		slug: "shared-boundaries",
		title: "Claimed errors leave the type",
	},
	{
		body: "The registry is the cache and AtomRpc makes the atoms. These packages add only what Atom leaves out.",
		icon: <Workflow />,
		slug: "overview",
		title: "Thin layers on Effect Atom",
	},
];

/** Mistakes a coding agent makes, and the tool that stops each one. */
const mistakes: ReadonlyArray<{
	readonly caughtBy: string;
	readonly code: Sample;
	readonly report?: string;
	readonly title: string;
}> = [
	{
		caughtBy: "Doesn't compile",
		code: fetchInRender,
		title: "Fetches in a component",
	},
	{
		caughtBy: "Doesn't compile",
		code: misspelledTag,
		title: "Misspells a tag",
	},
	{
		caughtBy: "Doesn't compile",
		code: forgottenTag,
		title: "Forgets a tag",
	},
];

/** The heading's text, linking to its own id. */
function HashLink(props: {
	readonly children: ReactNode;
	readonly id: string;
}) {
	return (
		<a className="heading-anchor" href={`#${props.id}`}>
			{props.children}
		</a>
	);
}

/** The samples' code, one after the other. */
const code = (...samples: ReadonlyArray<Sample>) =>
	samples.flatMap((sample) => sample.segments);

/**
 * Start and React Router keep the loader and its components in one file;
 * Next.js splits the server page from the client components it renders.
 */
const heroByMode = {
	nextjs: code(pageNext, componentNext),
	"react-router": code(heroRouter),
	"tanstack-start": code(heroStart),
} as const satisfies Record<FrameworkMode, ReadonlyArray<DocSegment>>;

const howItWorksByMode = {
	nextjs:
		"A page says what it needs before it renders. The atoms are made once from the RPC client, the server component starts every request as the page renders, client components read the results as they arrive, and boundaries catch the failures by tag.",
	"react-router":
		"A page says what it needs before it renders. The atoms are made once from the RPC client, the route’s loader starts every request as the navigation begins, components read the results as they arrive, and boundaries catch the failures by tag.",
	"tanstack-start":
		"A page says what it needs before it renders. The atoms are made once from the RPC client, the route’s loader starts every request as the navigation begins, components read the results as they arrive, and boundaries catch the failures by tag.",
} as const satisfies Record<FrameworkMode, string>;

interface Step {
	readonly body: ReactNode;
	readonly code: ReadonlyArray<DocSegment>;
	readonly guide: string;
	readonly id: string;
	readonly slug: string;
	readonly title: string;
}

/** Step 1's prose; only where `#rpc-transport` sends requests differs. */
const atomsStep = (
	clientCode: Sample,
	atomsCode: Sample,
	transport: ReactNode,
): Step => ({
	body: (
		<>
			<p>
				<code>AtomRpc.Service</code> turns the RPC contract into atoms:{" "}
				<code>{'IssuesClient.query("GetIssue", { id })'}</code> is an atom of
				that call’s <code>AsyncResult</code>, typed by the procedure’s success
				and failures. A serialization key lets the server send its result to the
				browser.
			</p>
			<p>{transport}</p>
		</>
	),
	code: code(clientCode, atomsCode),
	guide: "Quick start",
	id: "define-atoms",
	slug: "quick-start",
	title: "Make atoms from the RPC client",
});

/** The last two steps read the same in every framework but Next.js. */
const readStep = (componentCode: Sample, clientNote?: ReactNode): Step => ({
	body: (
		<>
			{clientNote}
			<p>
				A component takes the handle of the atom it reads, not an id, and{" "}
				<code>useAtomResult</code> reads that atom from the registry: it
				suspends until the result settles, and never starts a request of its
				own. Wrapped by the issue boundary, every failure goes to the boundary
				that claims its tag, so none is left in the type and the result is a
				success.
			</p>
			<p>
				A result still loading suspends only its own subtree, so the assignee
				streams in under its <code>Suspense</code> while the issue shows.
			</p>
		</>
	),
	code: code(componentCode),
	guide: "Reading atoms",
	id: "read-in-components",
	slug: "reading-atoms",
	title: clientNote
		? "Read them in client components"
		: "Read them in components",
});

const boundariesStep = (
	boundariesCode: Sample,
	clientNote?: ReactNode,
): Step => ({
	body: (
		<>
			<p>
				A boundary names what its errors come from, here the RPC client. Its{" "}
				<code>catchTags</code> keys are that client’s error tags, and each
				handler gets the error with that tag. UI code never imports an error
				class.
			</p>
			{clientNote}
			<p>
				The idea comes from{" "}
				<a
					className="font-medium text-foreground underline underline-offset-4"
					href="https://result-rpc.com/"
				>
					result-rpc
				</a>
				.
			</p>
		</>
	),
	code: code(boundariesCode),
	guide: "Error boundaries",
	id: "boundaries",
	slug: "error-boundaries",
	title: "Catch failures by tag",
});

const stepsByMode = {
	nextjs: [
		atomsStep(
			clientNext,
			atomsNext,
			<>
				<code>#rpc-transport</code> picks where requests go: server components
				call the RPC handler in the same process, and client components{" "}
				<code>POST /rpc</code>.
			</>,
		),
		{
			body: (
				<p>
					Server components share one request registry, which the verbs make
					through React’s <code>cache</code> and dispose when the render ends.
					The root layout holds the browser’s registry in{" "}
					<code>RegistryProvider</code>, turns on{" "}
					<code>WaterfallDetection</code>, and catches{" "}
					<code>RpcClientError</code> and <code>Unauthorized</code> once, for
					every page.
				</p>
			),
			code: code(layoutNext),
			guide: "Streaming and hydration",
			id: "set-up-the-registry",
			slug: "hydration",
			title: "Set up the registry",
		},
		{
			body: (
				<>
					<p>
						A server component runs as soon as the App Router renders the page.
						Every atom the page needs starts there, at the same time, before
						client components render.
					</p>
					<p>
						<code>prefetch</code> starts an atom without waiting, and{" "}
						<code>ensure</code> waits for one the page can’t lay out without.
						Each returns a handle, which the page passes to the client component
						that reads the atom. In a server component,{" "}
						<code>HydrationBoundary</code> takes the request’s registry and
						sends it to the browser’s, with the results still loading as
						promises, so nothing is fetched twice.
					</p>
				</>
			),
			code: code(pageNext),
			guide: "Loader verbs",
			id: "start-in-the-loader",
			slug: "loader-verbs",
			title: "Start them in a server component",
		},
		readStep(
			componentNext,
			<p>
				Client components live in their own files, marked{" "}
				<code>{'"use client"'}</code>.
			</p>,
		),
		boundariesStep(
			boundariesNext,
			<p>
				Boundaries are client components too. The server page renders the issue
				boundary around <code>IssuePage</code>.
			</p>,
		),
	],
	"react-router": [
		atomsStep(
			clientRouter,
			atomsRouter,
			<>
				<code>#rpc-transport</code> picks where requests go: on the server they
				call the RPC handler in the same process, and in the browser they{" "}
				<code>POST /rpc</code>, a resource route.
			</>,
		),
		{
			body: (
				<p>
					<code>atomsMiddleware</code> gives each server request its own
					registry, under a router context every loader reads. In the browser,
					the root’s <code>RegistryProvider</code> holds the registry each
					route’s <code>HydrationBoundary</code> fills, and{" "}
					<code>clientAtomsMiddleware</code> hands it to client loaders. The
					root also turns on <code>WaterfallDetection</code> and catches{" "}
					<code>RpcClientError</code> and <code>Unauthorized</code> once, for
					every page.
				</p>
			),
			code: code(contextRouter, rootRouter),
			guide: "Streaming and hydration",
			id: "set-up-the-registry",
			slug: "hydration",
			title: "Set up the registry",
		},
		{
			body: (
				<>
					<p>
						React Router runs the loader as soon as a navigation starts: on the
						server for the first page, and in the browser after that, as the
						route’s <code>clientLoader</code>. Every atom the page needs starts
						there, at the same time, before anything renders.
					</p>
					<p>
						<code>prefetch</code> starts an atom without waiting, and{" "}
						<code>ensure</code> waits for one the page can’t lay out without.
						The loader returns the handles they return with{" "}
						<code>atoms.dehydrate()</code>, React Router streams the results
						still loading, and <code>HydrationBoundary</code> writes them into
						the browser’s registry, so nothing is fetched twice.
					</p>
				</>
			),
			code: code(loaderRouter),
			guide: "Loader verbs",
			id: "start-in-the-loader",
			slug: "loader-verbs",
			title: "Start them in the route loader",
		},
		readStep(componentRouter),
		boundariesStep(boundariesRouter),
	],
	"tanstack-start": [
		atomsStep(
			clientStart,
			atomsStart,
			<>
				<code>#rpc-transport</code> picks where requests go: during server
				rendering they call the RPC handler in the same process, and in the
				browser they <code>POST /rpc</code>, a server route.
			</>,
		),
		{
			body: (
				<>
					<p>
						<code>getRouter</code> runs once per request on the server and once
						in the browser. <code>makeRegistry()</code> makes a request registry
						on the server and the browser’s registry in the browser, and{" "}
						<code>Loader.make</code> puts the verbs on the router context.
					</p>
					<p>
						<code>setupRouterAtoms</code> streams the server’s registry into the
						page once the loaders have run, and hydrates the browser’s from it.
						The root route turns on <code>WaterfallDetection</code> and catches{" "}
						<code>RpcClientError</code> and <code>Unauthorized</code> once, for
						every page.
					</p>
				</>
			),
			code: code(routerStart, rootStart),
			guide: "TanStack Start",
			id: "set-up-the-registry",
			slug: "tanstack-start",
			title: "Set up the registry",
		},
		{
			body: (
				<>
					<p>
						The router runs the loader as soon as a navigation starts, and with{" "}
						<code>{'defaultPreload: "intent"'}</code>, when a link is hovered.
						Every atom the page needs starts there, at the same time, before
						anything renders.
					</p>
					<p>
						<code>prefetch</code> starts an atom without waiting, and{" "}
						<code>ensure</code> waits for one the page can’t lay out without.
						The loader returns the handles they return, for the page to pass
						down. Results still loading cross to the browser as promises, so
						nothing is fetched twice.
					</p>
				</>
			),
			code: code(routeStart),
			guide: "Loader verbs",
			id: "start-in-the-loader",
			slug: "loader-verbs",
			title: "Start them in the route loader",
		},
		readStep(componentStart),
		boundariesStep(boundariesStart),
	],
} as const satisfies Record<FrameworkMode, ReadonlyArray<Step>>;

function HomePage() {
	const search = Route.useSearch();
	// Client navigations and hydration; first paint uses frameworkModeScript.
	syncFrameworkModeAttribute(search.mode);
	return (
		<main>
			<section className="relative border-b">
				<div
					aria-hidden="true"
					className="pointer-events-none absolute inset-0 overflow-hidden [background-image:radial-gradient(circle_at_1px_1px,var(--border)_1px,transparent_0)] [background-size:24px_24px] [mask-image:linear-gradient(to_bottom,black,transparent)]"
				/>
				<div className="relative mx-auto grid max-w-7xl items-start gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:py-24">
					<div className="grid gap-6 lg:sticky lg:top-36">
						<Badge className="w-fit" variant="outline">
							<Sparkles /> Early · 0.x
						</Badge>
						<h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
							{site.tagline}
						</h1>
						<p className="max-w-xl text-lg text-pretty text-muted-foreground">
							Start atoms from route loaders, stream them into the browser with
							their typed failures intact, and catch those failures by tag in
							React. Two thin layers on{" "}
							<a
								className="font-medium text-foreground underline underline-offset-4"
								href="https://github.com/Effect-TS/effect/tree/effect%404.0.6/packages/effect/src/reactivity"
							>
								Effect Atom
							</a>{" "}
							and Effect RPC.
						</p>
						<div className="flex flex-wrap gap-3">
							<Link
								className={cn(buttonVariants({ size: "lg" }))}
								params={{ slug: "quick-start" }}
								to="/docs/$slug"
							>
								Get started <ArrowRight />
							</Link>
							<Link
								className={cn(
									buttonVariants({ size: "lg", variant: "outline" }),
								)}
								params={{ slug: "overview" }}
								to="/docs/$slug"
							>
								Read the overview
							</Link>
						</div>
					</div>
					{/* pt-14 is the room the framework pill docks in, above the code.
					    Every mode ships in the HTML; CSS and frameworkModeScript pick. */}
					<div
						className="relative min-w-0 pt-14 [&_.code-block:first-child]:mt-0"
						id="hero-code"
					>
						<FrameworkModeBar />
						{frameworkModes.map((mode) => (
							<div data-framework-panel={mode} key={mode}>
								<DocBody segments={heroByMode[mode]} />
							</div>
						))}
					</div>
				</div>
			</section>

			<section
				aria-labelledby="how-it-works"
				className="mx-auto max-w-7xl border-b px-4 py-16 sm:px-6"
			>
				<h2
					className="mb-2 scroll-mt-32 text-2xl font-semibold tracking-tight"
					id="how-it-works"
				>
					<HashLink id="how-it-works">How a route loads its data</HashLink>
				</h2>
				{/* Every mode is in the HTML. Steps share ids, so frameworkModeScript
				    and syncFrameworkModeAttribute set them on the visible panel only. */}
				{frameworkModes.map((mode) => (
					<div data-framework-panel={mode} key={mode}>
						<p className="mb-12 max-w-2xl text-muted-foreground">
							{howItWorksByMode[mode]}
						</p>
						<ol className="grid gap-16">
							{stepsByMode[mode].map((step, index) => (
								<li
									className="grid scroll-mt-32 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:gap-12"
									data-step-id={step.id}
									id={mode === defaultFrameworkMode ? step.id : undefined}
									key={step.id}
								>
									<div className="grid content-start gap-4 lg:sticky lg:top-36">
										<h3 className="flex items-center gap-3 text-xl font-semibold tracking-tight">
											<span
												aria-hidden="true"
												className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-sm text-primary-foreground"
											>
												{index + 1}
											</span>
											<HashLink id={step.id}>{step.title}</HashLink>
										</h3>
										<div className="grid gap-3 text-muted-foreground [&_code]:font-mono [&_code]:text-[0.9em] [&_code]:text-foreground">
											{step.body}
										</div>
										<Link
											className="w-fit text-sm font-medium underline underline-offset-4"
											params={{ slug: step.slug }}
											to="/docs/$slug"
										>
											{step.guide} <ArrowRight className="inline size-4" />
										</Link>
									</div>
									<div className="min-w-0 [&_.code-block]:my-0!">
										<DocBody segments={step.code} />
									</div>
								</li>
							))}
						</ol>
					</div>
				))}
			</section>

			<section
				aria-labelledby="packages"
				className="mx-auto max-w-7xl border-b px-4 py-16 sm:px-6"
			>
				<h2
					className="mb-2 scroll-mt-24 text-2xl font-semibold tracking-tight"
					id="packages"
				>
					<HashLink id="packages">Two packages, each on its own</HashLink>
				</h2>
				<p className="mb-8 max-w-2xl text-muted-foreground">
					Use the boundaries without the loaders, or the loaders without the
					boundaries. Together, a failure from the server is caught in the
					browser by the boundary that claims its tag.
				</p>
				<ul className="grid gap-4 md:grid-cols-2">
					{packages.map((item) => (
						<li
							className="grid gap-3 rounded-xl border bg-card p-6"
							key={item.name}
						>
							<span className="font-mono text-lg font-semibold">
								{item.name}
							</span>
							<span className="text-muted-foreground">{item.body}</span>
							<code className="font-mono text-sm text-muted-foreground">
								<span className="select-none">$ </span>
								{item.install}
							</code>
							<Link
								className="w-fit text-sm font-medium underline underline-offset-4"
								params={{ slug: item.slug }}
								to="/docs/$slug"
							>
								Read the guide <ArrowRight className="inline size-4" />
							</Link>
						</li>
					))}
				</ul>
			</section>

			<section
				aria-labelledby="coding-agents"
				className="mx-auto grid max-w-7xl items-start gap-10 border-b px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]"
			>
				<div className="grid content-start gap-4 lg:sticky lg:top-24">
					<h2
						className="scroll-mt-24 text-2xl font-semibold tracking-tight"
						id="coding-agents"
					>
						<HashLink id="coding-agents">Wrong code fails loudly</HashLink>
					</h2>
					<p className="text-muted-foreground">
						Coding agents write what compiles and runs. Here, the usual mistakes
						don’t: a fetch in a component throws in development, and a
						misspelled tag, or a match that forgets one, is a type error. The
						agent is corrected by the tools before a reviewer sees the code.
					</p>
					<p className="text-muted-foreground">
						<a
							className="font-medium text-foreground underline underline-offset-4"
							href="/llms.txt"
						>
							llms.txt
						</a>{" "}
						starts with the rules, so an agent reads what to write before it
						writes it.
					</p>
					<Link
						className="w-fit text-sm font-medium underline underline-offset-4"
						params={{ slug: "coding-agents" }}
						to="/docs/$slug"
					>
						Rules for coding agents <ArrowRight className="inline size-4" />
					</Link>
				</div>
				<ol className="grid min-w-0 gap-8">
					{mistakes.map((mistake) => (
						<li className="grid min-w-0 gap-3" key={mistake.title}>
							<p className="flex flex-wrap items-baseline gap-x-2 text-sm">
								<span className="font-semibold">{mistake.title}</span>
								<span className="font-mono text-xs text-muted-foreground">
									{mistake.caughtBy}
								</span>
							</p>
							<div className="min-w-0 [&_.code-block]:my-0!">
								<DocBody segments={mistake.code.segments} />
							</div>
							{mistake.report === undefined ? null : (
								<p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 font-mono text-xs leading-relaxed">
									<span className="font-semibold text-destructive">Error:</span>{" "}
									{mistake.report}
								</p>
							)}
						</li>
					))}
				</ol>
			</section>

			<section
				aria-labelledby="features"
				className="mx-auto max-w-7xl px-4 py-16 sm:px-6"
			>
				<h2
					className="mb-8 scroll-mt-24 text-2xl font-semibold tracking-tight"
					id="features"
				>
					<HashLink id="features">What you get</HashLink>
				</h2>
				<ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{features.map((feature) => (
						<li key={feature.title}>
							<Link
								className="grid h-full gap-2 rounded-xl border bg-card p-5 transition-colors hover:bg-accent/50 [&_svg]:size-5"
								params={{ slug: feature.slug }}
								to="/docs/$slug"
							>
								<span className="text-muted-foreground">{feature.icon}</span>
								<span className="font-semibold">{feature.title}</span>
								<span className="text-sm text-muted-foreground">
									{feature.body}
								</span>
							</Link>
						</li>
					))}
				</ul>
			</section>
		</main>
	);
}
