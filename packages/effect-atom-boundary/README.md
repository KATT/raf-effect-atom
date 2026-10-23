# effect-atom-boundary

Typed error boundaries for [Effect Atom](https://github.com/Effect-TS/effect/tree/main/packages/atom/react). A boundary catches an atom's failures by `_tag`, with a handler per tag typed by the error with that tag. The tags come from the atom's error type, so a misspelled tag is a type error and UI code never imports an error class.

**[GitHub](https://github.com/KATT/raf-effect-atom)**

> [!NOTE]
> effect-atom-boundary is early. The API can still change between minor releases.

## Install

```bash
npm install effect-atom-boundary effect @effect/atom-react react
```

`effect`, `@effect/atom-react` and `react` (19 or newer) are peer dependencies.

## Usage

`AtomErrorBoundary` guards one atom. The read under it reads `AtomErrorBoundary.claim(atom)`, the same atom with its typed failures turned into defects, so `useAtomSuspense` throws them to the boundary:

```tsx
import { useAtomSuspense } from "@effect/atom-react";
import { AtomErrorBoundary } from "effect-atom-boundary";

// issue: (id: number) => Atom<AsyncResult<Issue, IssueNotFound | Unauthorized | RpcClientError>>

function IssuePage(props: { readonly id: number }) {
	const result = useAtomSuspense(AtomErrorBoundary.claim(issue(props.id)), {
		suspendOnWaiting: true,
	});
	return <h1>{result.value.title}</h1>;
}

<AtomErrorBoundary
	atom={issue(id)}
	catchTags={{
		IssueNotFound: ({ error, reset }) => (
			<NotFound id={error.id} onRetry={reset} />
		),
	}}
>
	<Suspense fallback={<Spinner />}>
		<IssuePage id={id} />
	</Suspense>
</AtomErrorBoundary>;
```

`createErrorBoundary` makes a shared boundary for failures that belong to the app, such as Effect RPC's `RpcClientError`, which every procedure fails with when the request doesn't reach the server. `errors` names what the errors come from: an `AtomRpc` client, an atom, or an atom family. The hook's `wrap(atom)` turns what the boundary and the ones above it claim into defects, so a read that returns typed failures and throws defects, such as [`raf-effect-atom`](https://github.com/KATT/raf-effect-atom/tree/main/packages/raf-effect-atom)'s `useAtomResult`, gets a result typed without them:

```tsx
import { createErrorBoundary } from "effect-atom-boundary";
import { useAtomResult } from "raf-effect-atom";

const [AppBoundary, useAppBoundary] = createErrorBoundary({
	name: "App",
	errors: Issues,
	catchTags: { RpcClientError: ({ reset }) => <Offline onRetry={reset} /> },
});

function IssueTitle(props: { readonly id: number }) {
	const result = useAtomResult(useAppBoundary().wrap(issue(props.id)));
	// AsyncResult<Issue, IssueNotFound | Unauthorized>: RpcClientError is claimed
}
```

`reset` refreshes the atom that failed and renders the children again.

## For coding agents

Catch `RpcClientError` once, in a boundary around the app. Handle each failure by its tag, in a boundary's `catchTags` or by `_tag` in the component. Don't render one message for every failure or branch on `error.message`. The full rules, with the reason for each: [For coding agents](https://raf-effect-atom.katt.dev/docs/coding-agents). The docs as markdown: [llms.txt](https://raf-effect-atom.katt.dev/llms.txt).

## Credits

The idea comes from [result-rpc](https://result-rpc.com/), whose [Shells](https://result-rpc.com/concepts/shells/) are error boundaries that claim failures and remove them from the component's error type.

## License

MIT
