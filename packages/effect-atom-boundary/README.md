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

`AtomErrorBoundary` guards one atom. The read under it, `useAtomResult`, suspends like `useAtomSuspense` and throws the atom's typed failures to the boundary:

```tsx
import { AtomErrorBoundary, useAtomResult } from "effect-atom-boundary";

// issue: (id: number) => Atom<AsyncResult<Issue, IssueNotFound | Unauthorized | RpcClientError>>

function IssuePage(props: { readonly id: number }) {
	const result = useAtomResult(issue(props.id));
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

`createErrorBoundary` makes a shared boundary for failures that belong to the app, such as being signed out. `errors` names what the errors come from: an `AtomRpc` client, an atom, or an atom family. A read through the boundary's hook gets a result typed without what the boundaries above it claim:

```tsx
import { createErrorBoundary, useAtomResult } from "effect-atom-boundary";

const [AuthBoundary, useAuthBoundary] = createErrorBoundary({
	name: "Auth",
	errors: Issues,
	catchTags: { Unauthorized: ({ reset }) => <SignIn onSignedIn={reset} /> },
});

function IssueTitle(props: { readonly id: number }) {
	const result = useAtomResult(issue(props.id), useAuthBoundary());
	// AsyncResult<Issue, IssueNotFound | RpcClientError>: Unauthorized is claimed
}
```

`reset` refreshes the atom that failed and renders the children again. `claim(atom, registry, result, claims)` is the claiming step on its own, for a read hook of your own.

## Credits

The idea comes from [result-rpc](https://result-rpc.com/), whose [Shells](https://result-rpc.com/concepts/shells/) are error boundaries that claim failures and remove them from the component's error type.

## License

MIT
