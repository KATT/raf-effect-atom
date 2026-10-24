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

A boundary catches the tags its `catchTags` name, and no others. `createErrorBoundary` makes one, with a hook that takes a read's `AsyncResult`, such as what [`raf-effect-atom`](https://github.com/KATT/raf-effect-atom/tree/main/packages/raf-effect-atom)'s `useAtomResult` returns, throws the tags it and the boundaries above it catch to their boundaries, and returns the failures left, typed without them:

```tsx
import { Match, Option } from "effect";
import { AsyncResult } from "effect/reactivity";
import { createErrorBoundary } from "effect-atom-boundary";
import { type Handle, useAtomResult } from "raf-effect-atom";

const [AppBoundary] = createErrorBoundary({
	name: "App",
	errors: Issues,
	catchTags: { RpcClientError: ({ reset }) => <Offline onRetry={reset} /> },
});

const [IssueBoundary, useIssueBoundary] = createErrorBoundary({
	name: "Issue",
	errors: Issues,
	parent: AppBoundary,
	catchTags: { IssueNotFound: ({ error }) => <NotFound id={error.id} /> },
});

function IssueTitle(props: { readonly issue: Handle<typeof issue> }) {
	const result = useIssueBoundary(useAtomResult(issue, props.issue));
	if (AsyncResult.isSuccess(result)) {
		return <h1>{result.value.title}</h1>;
	}
	return Match.valueTags(Option.getOrThrow(AsyncResult.error(result)), {
		Unauthorized: () => <SignIn />,
	});
}

<AppBoundary>
	<IssueBoundary>
		<Suspense fallback={<Spinner />}>
			<IssueTitle issue={issueHandle} />
		</Suspense>
	</IssueBoundary>
</AppBoundary>;
```

`issue`'s error is `IssueNotFound | Unauthorized | RpcClientError`. `issueHandle` is the handle the route's loader got from `raf-effect-atom`'s `ensure(issue, id)`. The hook throws `IssueNotFound` to `<IssueBoundary>` and `RpcClientError` to `<AppBoundary>`, and returns `Unauthorized`, the one failure left. `errors` names what the errors come from, for the types: an `AtomRpc` client, an atom, or an atom family. A handler's `reset` refreshes every atom whose failure the boundary has a handler for, and renders the children again.

When the boundaries' `catchTags` name every tag of the atom's error, the hook types the result as a success. See [Error boundaries](https://raf-effect-atom.katt.dev/docs/error-boundaries).

`AtomErrorBoundary` is a separate component for one atom (`<AtomErrorBoundary atom={issue(id)} catchTags={…}>`), with no hook. It catches the atom's failures that a read under it throws, such as `useAtomSuspense(atom)`, and a tag without a handler goes to the boundaries above.

## For coding agents

Catch `RpcClientError` once, in a boundary around the app. Handle each failure by its tag, in a boundary's `catchTags` or by `_tag` in the component. Don't render one message for every failure or branch on `error.message`. The full rules, with the reason for each: [For coding agents](https://raf-effect-atom.katt.dev/docs/coding-agents). The docs as markdown: [llms.txt](https://raf-effect-atom.katt.dev/llms.txt).

## Credits

The idea comes from [result-rpc](https://result-rpc.com/), whose [Shells](https://result-rpc.com/concepts/shells/) are error boundaries that claim failures and remove them from the component's error type.

## License

MIT
