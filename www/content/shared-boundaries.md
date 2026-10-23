---
title: Shared boundaries
description: createErrorBoundary makes a boundary for failures that belong to the app, and a hook that types the reads under it without the errors it claims.
section: effect-atom-boundary
order: 2
---

Some failures belong to the app rather than to the component that read them. Any procedure can fail with `Unauthorized`, and every component handling it would repeat the same sign-in prompt. `createErrorBoundary` makes one boundary for it, returned as a component and a hook you name by destructuring:

```sample
tanstack-start/src/boundaries.tsx#auth
```

`errors` names what the errors come from, for the types only: an `AtomRpc` client (the errors of all its procedures), an atom, or an atom family. `name` names the boundary in messages and React DevTools: `"Auth"` is `<AuthBoundary>`.

## Reads under the boundary

`useAuthBoundary().wrap(atom)` returns the same atom with the failures the boundary claims turned into defects, recorded with the atom. A read that returns typed failures and throws defects, such as `raf-effect-atom`'s `useAtomResult`, throws them to the boundary and returns a result typed without them:

```sample
tanstack-start/src/docs/shared-boundaries.tsx#narrowed
```

The hook throws when its boundary isn't mounted above the component:

```sample
tanstack-start/src/docs/shared-boundaries.tsx#app
```

A tag that none of `errors`' procedures can fail with is a type error:

```sample
tanstack-start/src/docs/shared-boundaries.tsx#misspelled
```

## Chained boundaries

`parent` puts a boundary under another one. An atom wrapped by the child's claims throws the tags either boundary claims, each to the nearest boundary that claims it, and the claimed tags add up along the chain:

```sample
tanstack-start/src/boundaries.tsx#issue
```

A read of `useIssueBoundary().wrap(atom)` throws `IssueNotFound` to `<IssueBoundary>` and `Unauthorized` to `<AuthBoundary>`, and returns a result whose only failure left is `RpcClientError`. `<IssueBoundary>` throws when `<AuthBoundary>` isn't mounted above it.

```demo
boundary-chain
```

## Matching is by tag

A shared boundary catches a claimed tag from any atom read under it, not only from the atoms its claims wrapped. `reset` refreshes the atom whose read threw the failure.

## Reading a wrapped atom

The wrapper is a derived atom with no serialization key: start the atom itself in loaders, and read the wrapper in components. It points at the atom with Effect's `initialValueTarget`, which `raf-effect-atom`'s `useAtomResult` follows to hydrate the atom and wait for its streamed result.

`useAtomSuspense` with `includeFailure` returns claimed failures instead of throwing them, and without it throws every failure, including the ones left. Under a shared boundary, use a read that throws only defects: `raf-effect-atom`'s `useAtomResult`, or your own over `useAtomSuspense(atom, { includeFailure: true, suspendOnWaiting: true })`.
