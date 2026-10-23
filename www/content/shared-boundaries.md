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

A read with the boundary's hook throws what the boundary claims, and returns a result typed without it:

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

`parent` puts a boundary under another one. A read with the child's hook throws the tags either boundary claims, each to the nearest boundary that claims it, and the claimed tags add up along the chain:

```sample
tanstack-start/src/boundaries.tsx#issue
```

A read with `useIssueBoundary()` throws `IssueNotFound` to `<IssueBoundary>` and `Unauthorized` to `<AuthBoundary>`, and returns a result whose only failure left is `RpcClientError`. `<IssueBoundary>` throws when `<AuthBoundary>` isn't mounted above it.

## Matching is by tag

A shared boundary catches a claimed tag from any atom read under it, not only from the reads that used its hook. `reset` refreshes the atom whose read threw the failure.

## Claiming without the hook

`claim(atom, registry, result, claims)` is the claiming step on its own: it throws a claimed failure to its boundary and returns the rest of the result, narrowed. `useAtomResult` is that step inside a hook, and `raf-effect-atom`'s read hook calls it through the claims you pass it.
