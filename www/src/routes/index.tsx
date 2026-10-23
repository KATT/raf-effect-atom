import { Badge } from "@examples/ui/components/badge";
import { buttonVariants } from "@examples/ui/components/button";
import { cn } from "@examples/ui/lib/utils";
import { createFileRoute, Link } from "@tanstack/react-router";
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
import boundaries from "sample:tanstack-start/src/boundaries.tsx#issue";
import route from "sample:tanstack-start/src/routes/issues.$id.tsx#hero";

import { DocBody } from "~/components/doc-body.tsx";
import { pageHead } from "~/seo.ts";
import { site } from "~/site.ts";

export const Route = createFileRoute("/")({
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
		slug: "loader-verbs",
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

function HomePage() {
	return (
		<main>
			<section className="relative border-b">
				<div
					aria-hidden="true"
					className="pointer-events-none absolute inset-0 overflow-hidden [background-image:radial-gradient(circle_at_1px_1px,var(--border)_1px,transparent_0)] [background-size:24px_24px] [mask-image:linear-gradient(to_bottom,black,transparent)]"
				/>
				<div className="relative mx-auto grid max-w-7xl items-start gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:py-24">
					<div className="grid gap-6 lg:sticky lg:top-24">
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
					<div className="min-w-0 [&_.code-block:first-child]:mt-0">
						<DocBody segments={route.segments} />
					</div>
				</div>
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
				aria-labelledby="boundaries"
				className="mx-auto grid max-w-7xl items-start gap-10 border-b px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]"
			>
				<div className="grid content-start gap-4 lg:sticky lg:top-24">
					<h2
						className="scroll-mt-24 text-2xl font-semibold tracking-tight"
						id="boundaries"
					>
						<HashLink id="boundaries">Boundaries that know the errors</HashLink>
					</h2>
					<p className="text-muted-foreground">
						A boundary names what its errors come from, here the RPC client. Its{" "}
						<code className="font-mono text-[0.9em]">catchTags</code> keys are
						that client’s error tags, and each handler gets the error with that
						tag. UI code never imports an error class.
					</p>
					<p className="text-muted-foreground">
						The idea comes from{" "}
						<a
							className="font-medium text-foreground underline underline-offset-4"
							href="https://result-rpc.com/"
						>
							result-rpc
						</a>
						.
					</p>
				</div>
				<div className="min-w-0 [&_.code-block]:my-0!">
					<DocBody segments={boundaries.segments} />
				</div>
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
