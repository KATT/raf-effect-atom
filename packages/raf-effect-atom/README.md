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

A loader starts atoms with a verb per call, given an atom family and its arguments. `prefetch` starts one and streams it, `ensure` waits for its first result, and `fetch` waits for a fresh one. Each returns a handle, plain data naming the atom, which the loader returns for the page to pass down. Typed failures come back as results, so a loader can redirect on a tag:

```ts
import { Loader } from "raf-effect-atom";

// issue: (id: number) => an AtomRpc query with a serializationKey
export async function loader(args: LoaderArgs) {
	const id = Number(args.params.id);
	const handles = {
		comments: args.context.atoms.prefetch(comments, id),
		issue: await args.context.atoms.ensure(issue, id),
	};
	const result = Loader.result(handles.issue);
	if (AsyncResult.isFailure(result)) {
		// result.cause holds IssueNotFound | Unauthorized | RpcClientError
	}
	return handles;
}
```

A component takes the handle as a prop and reads it with `useAtomResult(source, handle)`, which waits for a streamed result instead of starting the atom again, and returns typed failures. Given a handle instead of an id, it can't start a request of its own. The source can be a family derived from the loader's, such as the one an [`effect-atom-boundary`](https://github.com/KATT/raf-effect-atom/tree/main/packages/effect-atom-boundary) boundary's hook returns, which throws the errors that boundary claims to it:

```tsx
import { type Handle, useAtomResult } from "raf-effect-atom";

function IssueTitle(props: { readonly issue: Handle<typeof issue> }) {
	const result = useAtomResult(useIssueBoundary(issue), props.issue);
	// Success<Issue, never>: its boundaries claim every failure
	return <h1>{result.value.title}</h1>;
}
```

Each framework has a subpath that gives every server request its own registry and sends it to the browser:

- `raf-effect-atom/tanstack-router`, for TanStack Router and TanStack Start: `setupRouterAtoms({ router, registry })` in `getRouter`, with `Loader.make(registry)` on the router context.
- `raf-effect-atom/rsc`, for React Server Components such as the Next.js App Router: `prefetch`, `ensure` and `fetch` in server components, which pass the handles to client components as props, and `<HydrationBoundary registry={getRegistry()}>` around them. `HydrationBoundary` and `RegistryProvider` come from `raf-effect-atom` itself: server components get the build that takes the request's registry through the `react-server` export condition. `makeRequestAtoms({ seed })` makes the same functions over a registry seeded from the request, such as with its cookie.
- `raf-effect-atom/react-router`, for Framework Mode: `atomsMiddleware(atomsContext)` as the root middleware and `clientAtomsMiddleware(atomsContext)` as its client middleware, loaders that return `atoms.dehydrate()` with their handles and double as client loaders, and `<HydrationBoundary state={loaderData.atoms}>` in the route component.

In development, `useAtomResult` reports a read that starts an atom nothing started, a request waterfall. `<WaterfallDetection mode="throw">` at the root makes it throw to the nearest error boundary. `useWaterfall(source, ...args)` starts an atom whose input exists only in render, marks it as a known waterfall, and returns its handle.

## For coding agents

Start every atom in a loader or a server component, never in a component or `useEffect`, and put the state that picks data (pages, filters, open dialogs) in the URL so the loader can. Event handlers and `useWaterfall` are escape hatches for state that can't be in the URL. Pass components the handles the loader returns, not ids, and read them with `useAtomResult`, not `useAtomValue` or `useAtomSuspense`. Keep `<WaterfallDetection mode="throw">` at the root and fix what it reports instead of turning it off. The full rules, with the reason for each: [For coding agents](https://raf-effect-atom.katt.dev/docs/coding-agents). The docs as markdown: [llms.txt](https://raf-effect-atom.katt.dev/llms.txt).

## License

MIT
