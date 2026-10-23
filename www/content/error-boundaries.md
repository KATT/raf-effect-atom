---
title: Error boundaries
description: AtomErrorBoundary catches one atom's failures by tag, with a handler per tag typed by the error with that tag.
section: effect-atom-boundary
order: 1
---

`effect-atom-boundary` gives Effect Atom typed [error boundaries](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary). An atom's `AsyncResult` carries its error type, such as `IssueNotFound | Unauthorized | RpcClientError` for an [`AtomRpc`](https://github.com/Effect-TS/effect/blob/effect%404.0.6/packages/effect/src/reactivity/AtomRpc.ts) query: the errors its procedure declares, and Effect RPC's [`RpcClientError`](https://github.com/Effect-TS/effect/blob/effect%404.0.6/packages/effect/src/rpc/RpcClientError.ts), which every procedure fails with when the request doesn't reach the server or the answer doesn't decode. A boundary catches those failures by `_tag`: its `catchTags` keys come from the atom's error type, so UI code never imports an error class, and a misspelled tag doesn't compile.

It needs only `effect`, [`@effect/atom-react`](https://github.com/Effect-TS/effect/tree/effect%404.0.6/packages/atom/react) and React. It works the same with or without `raf-effect-atom`.

The idea comes from [result-rpc](https://result-rpc.com/), whose [Shells](https://result-rpc.com/concepts/shells/) are error boundaries that claim failures and remove them from the component's error type. `effect-atom-boundary` is that idea over Effect Atom, claiming by `_tag`.

## One boundary for one atom

`AtomErrorBoundary` guards one atom. The read under it reads `AtomErrorBoundary.claim(atom)`: the same atom with its typed failures turned into defects, recorded with the atom, so [`useAtomSuspense`](https://github.com/Effect-TS/effect/tree/effect%404.0.6/packages/atom/react) throws them to the boundary and the component gets the success value:

```sample
tanstack-start/src/docs/error-boundaries.tsx#boundary
```

A failure whose tag has a handler renders the handler in place of the children. `reset` refreshes the atom that failed and renders the children again. Pass `suspendOnWaiting: true`, so the read waits for that refresh instead of throwing the old failure again. `raf-effect-atom`'s `useAtomResult` does that on its own.

A handler renders as a component, so it can call hooks. A handler written inline is a new component each time the component around the boundary renders, so it mounts again and loses its state: give a handler with state a name outside the render.

```demo
atom-error-boundary
```

## Handlers are typed by their tag

Each handler's `error` is the member of the atom's error type with that tag:

```sample
tanstack-start/src/docs/error-boundaries.tsx#handler-types
```

A tag the atom can't fail with is a type error:

```sample
tanstack-start/src/docs/error-boundaries.tsx#misspelled
```

## What a boundary doesn't catch

- A failure whose tag has no handler, and a failure of another atom read under the boundary, go to the error boundaries above it.
- A defect or an interruption isn't a typed error: the read throws `Cause.squash(cause)` to the app's own error boundary.
- A claimed failure is a defect inside the wrapped atom's value, so code that inspects that value, such as `AsyncResult.error`, sees no typed error. Read the atom itself to inspect its failure.

For failures that belong to the app rather than to one atom, such as `RpcClientError` or being signed out, use a [shared boundary](./shared-boundaries.md) around the app. A tag with no handler in an `AtomErrorBoundary` goes on to it, as `RpcClientError` does above.
