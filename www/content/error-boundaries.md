---
title: Error boundaries
description: A boundary catches the errors its catchTags name, by tag, with a handler per tag typed by the error with that tag, and the reads under it are typed without them.
section: effect-atom-boundary
order: 1
---

`effect-atom-boundary` gives Effect Atom typed [error boundaries](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary). An atom's `AsyncResult` carries its error type, such as `IssueNotFound | Unauthorized | RpcClientError` for an [`AtomRpc`](https://github.com/Effect-TS/effect/blob/effect%404.0.6/packages/effect/src/reactivity/AtomRpc.ts) query: the errors its procedure declares, and Effect RPC's [`RpcClientError`](https://github.com/Effect-TS/effect/blob/effect%404.0.6/packages/effect/src/rpc/RpcClientError.ts), which every procedure fails with when the request doesn't reach the server or the answer doesn't decode. A boundary catches those failures by `_tag`: its `catchTags` keys come from the atom's error type, so UI code never imports an error class, and a misspelled tag doesn't compile.

It needs only `effect`, [`@effect/atom-react`](https://github.com/Effect-TS/effect/tree/effect%404.0.6/packages/atom/react) and React. It works the same with or without `raf-effect-atom`.

The idea comes from [result-rpc](https://result-rpc.com/), whose [Shells](https://result-rpc.com/concepts/shells/) are error boundaries that claim failures and remove them from the component's error type. `effect-atom-boundary` is that idea over Effect Atom, claiming by `_tag`.

## A boundary names the errors it catches

`createErrorBoundary` makes a boundary from its handlers, one per `_tag` it catches: a tag with a handler is caught, and a tag without one isn't. `issue`'s error is `IssueNotFound | Unauthorized | RpcClientError`. Here `<AppBoundary>` catches `RpcClientError`, and `<IssueBoundary>`, under it, catches `IssueNotFound`, so the read under them is left with `Unauthorized`:

```sample
tanstack-start/src/docs/error-boundaries.tsx#issue
```

- `catchTags` is what the boundary catches. Its keys are tags of `errors`' error type.
- `errors` names what the errors come from, for the types only: here the `issue` atom family. It can also be an atom, or an `AtomRpc` client for the errors of all its procedures.
- `name` names the boundary in messages and React DevTools: `"Issue"` is `<IssueBoundary>`.
- `parent` puts `<IssueBoundary>` under `<AppBoundary>`, and the tags they catch add up. `<IssueBoundary>` throws when its parent isn't mounted above it.

It returns the boundary component and its hook, named by destructuring.

## Reads under it are typed without what it catches

A component under `<IssueBoundary>` reads its handle through `useIssueBoundary().wrap(issue)`: the same atoms with the tags this boundary and its parents catch turned into defects. The read throws `IssueNotFound` to `<IssueBoundary>` and `RpcClientError` to `<AppBoundary>`. `raf-effect-atom`'s [`useAtomResult`](./reading-atoms.md) returns any other failure, typed without the caught tags. The `^?` above shows `Unauthorized`, the one tag of `issue`'s error that neither boundary's `catchTags` names, and the component handles it by its tag.

A caught failure renders the boundary's handler in place of its children. `reset` refreshes every atom in the registry that failed with a tag the boundary handles, and renders the children again.

A handler renders as a component, so it can call hooks. A handler written inline is a new component each time the component around the boundary renders, so it mounts again and loses its state: give a handler with state a name outside the render.

## When every tag is caught

When the boundaries' `catchTags` name every tag of the atom's error, no failure is left. `<IssuePageBoundary>` catches `IssueNotFound` and `Unauthorized`, and its parent, `<AppBoundary>`, catches `RpcClientError`, so the read's error type is `never` and `useAtomResult` returns a success:

```sample
tanstack-start/src/docs/every-tag-caught.tsx#every-tag
```

The `never` comes from those `catchTags`: without the `Unauthorized` handler, the read's error type is `Unauthorized` again, and the component has to handle it.

```demo
every-tag-caught
```

## Handlers are typed by their tag

Each handler's `error` is the member of the error type with that tag:

```sample
tanstack-start/src/docs/error-boundaries.tsx#handler-types
```

A tag the atom can't fail with is a type error:

```sample
tanstack-start/src/docs/error-boundaries.tsx#misspelled
```

## What a boundary doesn't catch

- A failure whose tag has no handler goes to the error boundaries above it.
- A defect or an interruption isn't a typed error: the read throws `Cause.squash(cause)` to the app's own error boundary.
- A claimed failure is a defect inside the wrapped atom's value, so code that inspects that value, such as `AsyncResult.error`, sees no typed error. Read the atom itself to inspect its failure.

A boundary from `createErrorBoundary` matches by tag: it catches its tags from any atom read under it, not only from the atoms its hook wrapped. [Shared boundaries](./shared-boundaries.md) covers boundaries for failures that belong to the app, such as `RpcClientError` and being signed out, and chaining them with `parent`.
