# raf-effect-atom

Render-as-you-fetch for [Effect Atom](https://github.com/Effect-TS/effect/tree/main/packages/atom/react). Route loaders start atoms before anything renders, the server streams their results into the browser, and the browser reads them without requesting them again. Typed failures survive the trip: a server-side `IssueNotFound` is an `IssueNotFound` in the browser.

**[GitHub](https://github.com/KATT/raf-effect-atom)**

> [!NOTE]
> raf-effect-atom is early. The API can still change between minor releases.

## Install

```bash
npm install raf-effect-atom effect @effect/atom-react react
```

`effect`, `@effect/atom-react` and `react` (19.2 or newer) are peer dependencies.

## Usage

A loader starts atoms with a verb per call. `prefetch` starts one and streams it, `ensure` waits for its first result, and `fetch` waits for a fresh one. Typed failures come back as results, so a loader can redirect on a tag:

```ts
// issue: (id: number) => an AtomRpc query with a serializationKey
export async function loader(args: LoaderArgs) {
	const id = Number(args.params.id);
	args.context.atoms.prefetch(comments(id));
	const result = await args.context.atoms.ensure(issue(id));
	if (AsyncResult.isFailure(result)) {
		// result.cause holds IssueNotFound | Unauthorized | RpcClientError
	}
}
```

A component reads the atom with `useAtomResult`, which waits for a streamed result instead of starting the atom again, and returns typed failures. It also reads an atom derived from one, such as the atom an [`effect-atom-boundary`](https://github.com/KATT/raf-effect-atom/tree/main/packages/effect-atom-boundary) boundary's `wrap` returns, which throws the errors that boundary claims to it:

```tsx
import { useAtomResult } from "raf-effect-atom";

function IssueTitle(props: { readonly id: number }) {
	const result = useAtomResult(useIssueBoundary().wrap(issue(props.id)));
	// Success<Issue, never>: its boundaries claim every failure
	return <h1>{result.value.title}</h1>;
}
```

Each framework has a subpath that gives every server request its own registry and sends it to the browser:

- `raf-effect-atom/tanstack-router`, for TanStack Router and TanStack Start: `setupRouterAtoms({ router, registry })` in `getRouter`, with `Loader.make(registry)` on the router context.
- `raf-effect-atom/next`, for the App Router: `prefetch`, `ensure` and `fetch` in server components, and `<HydrateAtoms state={dehydrate()}>` around the client components that read them.
- `raf-effect-atom/react-router`, for Framework Mode: `atomsMiddleware(atomsContext)` as the root middleware, loaders that return `atoms.dehydrate()`, and `HydrationBoundary` in the route component.

In development, `useAtomResult` reports a read that starts an atom nothing started, a request waterfall. `<WaterfallDetection mode="throw">` at the root makes it throw to the nearest error boundary. `useWaterfall(atom)` starts an atom whose input exists only in render, and marks it as a known waterfall.

## For coding agents

Start every atom in a loader, a server component or an event handler, never in a component or `useEffect`. Read atoms with `useAtomResult`, not `useAtomValue` or `useAtomSuspense`. Keep `<WaterfallDetection mode="throw">` at the root and fix what it reports instead of turning it off. The full rules, with the reason for each: [For coding agents](https://raf-effect-atom.katt.dev/docs/coding-agents). The docs as markdown: [llms.txt](https://raf-effect-atom.katt.dev/llms.txt).

## License

MIT
