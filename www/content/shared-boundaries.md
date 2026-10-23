---
title: Shared boundaries
description: createErrorBoundary makes a boundary for failures that belong to the app, and a hook that types the reads under it without the errors it claims.
section: effect-atom-boundary
order: 2
---

Some failures belong to the app rather than to the component that read them. Every Effect RPC procedure fails with [`RpcClientError`](https://github.com/Effect-TS/effect/blob/effect%404.0.6/packages/effect/src/rpc/RpcClientError.ts) when the request doesn't reach the server or the answer doesn't decode: it's the connection failing, not one of the contract's errors, and every component handling it would repeat the same message. `createErrorBoundary` makes one boundary for it, returned as a component and a hook you name by destructuring:

```sample
tanstack-start/src/boundaries.tsx#app
```

`errors` names what the errors come from, for the types only: an `AtomRpc` client (the errors of all its procedures), an atom, or an atom family. `name` names the boundary in messages and React DevTools: `"App"` is `<AppBoundary>`. `reset` refreshes the atom whose read failed, so `Try again` loads it again once the server is back.

## Reads under the boundary

`useAppBoundary().wrap(atom)` returns the same atom with the failures the boundary claims turned into defects, recorded with the atom. A read that returns typed failures and throws defects, such as `raf-effect-atom`'s `useAtomResult`, throws them to the boundary and returns a result typed without them:

```sample
tanstack-start/src/docs/shared-boundaries.tsx#narrowed
```

The hook throws when its boundary isn't mounted above the component:

```sample
tanstack-start/src/docs/shared-boundaries.tsx#mounted
```

A tag that none of `errors`' procedures can fail with is a type error:

```sample
tanstack-start/src/docs/shared-boundaries.tsx#misspelled
```

## Chained boundaries

`parent` puts a boundary under another one. An atom wrapped by the child's claims throws the tags any boundary in the chain claims, each to the nearest boundary that claims it, and the claimed tags add up along the chain. Being signed out belongs to the app too, so `<AuthBoundary>` claims `Unauthorized` under `<AppBoundary>`, and `<IssueBoundary>` claims `IssueNotFound` under `<AuthBoundary>`:

```sample
tanstack-start/src/boundaries.tsx#auth
```

```sample
tanstack-start/src/boundaries.tsx#issue
```

A read of `useIssueBoundary().wrap(atom)` throws `IssueNotFound` to `<IssueBoundary>`, `Unauthorized` to `<AuthBoundary>` and `RpcClientError` to `<AppBoundary>`. No failure is left, so `useAtomResult` types its result as a success. `<IssueBoundary>` throws when `<AuthBoundary>` isn't mounted above it.

```demo
boundary-chain
```

## Matching is by tag

A shared boundary catches a claimed tag from any atom read under it, not only from the atoms its claims wrapped. `reset` refreshes the atom whose read threw the failure.

## Reading a wrapped atom

The wrapper is a derived atom with no serialization key: start the atom itself in loaders, and read the wrapper in components. It points at the atom with Effect's `initialValueTarget`, which `raf-effect-atom`'s `useAtomResult` follows to hydrate the atom and wait for its streamed result.

`useAtomSuspense` with `includeFailure` returns claimed failures instead of throwing them, and without it throws every failure, including the ones left. Under a shared boundary, use a read that throws only defects: `raf-effect-atom`'s `useAtomResult`, or your own over `useAtomSuspense(atom, { includeFailure: true, suspendOnWaiting: true })`.
