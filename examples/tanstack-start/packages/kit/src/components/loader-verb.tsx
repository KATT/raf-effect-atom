import type { LoaderVerb } from "@examples/kit/lib/loader-verb";

/**
 * Where an app's loaders run after the first page load. `server`: every
 * navigation loads on the server into a new, empty registry (React server
 * components), so `ensure` waits like `fetch`.
 */
export type LoaderRuntime = "browser" | "server";

const prefetchHint =
	"Never waits: pages open at once, and each part shows a skeleton until its result streams in.";

const hints = {
	browser: {
		ensure:
			"Waits for results the registry doesn't have. A result it still holds shows at once, without a request.",
		fetch:
			"Waits for fresh results: it starts each atom, or refreshes one the registry holds, and waits for it.",
		prefetch: prefetchHint,
	},
	server: {
		ensure:
			"Waits for results the registry doesn't have. Every navigation loads on the server into an empty registry, so here it waits like fetch every time.",
		fetch:
			"Waits for the results. Every navigation loads on the server into an empty registry, so it waits every time.",
		prefetch: prefetchHint,
	},
} satisfies Record<LoaderRuntime, Record<LoaderVerb, string>>;

/** What the loader verb in the URL does, under the top bar. */
export function LoaderVerbHint(props: {
	readonly loaders: LoaderRuntime;
	readonly verb: LoaderVerb;
}) {
	return (
		<p className="text-xs text-muted-foreground">
			<code className="font-mono font-medium text-foreground">
				{props.verb}
			</code>{" "}
			{hints[props.loaders][props.verb]}
		</p>
	);
}
