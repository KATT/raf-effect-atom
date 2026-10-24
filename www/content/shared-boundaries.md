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

`errors` names what the errors come from, for the types only: an `AtomRpc` client (the errors of all its procedures), an [`AtomHttpApi`](https://github.com/Effect-TS/effect/blob/effect%404.0.6/packages/effect/src/reactivity/AtomHttpApi.ts) client (the errors of all its endpoints and their middleware), an atom, or an atom family. An `AtomHttpApi` query's transport failures aren't among them: see [AtomHttpApi transport failures](#atomhttpapi-transport-failures). `name` names the boundary in messages and React DevTools: `"App"` is `<AppBoundary>`. `reset` refreshes every atom that failed with a tag the boundary handles, so `Try again` loads the page again once the server is back.

## Reads under the boundary

A component wraps its read in the boundary's hook. `useAppBoundary(result)` takes the `AsyncResult` a read returned, throws the failures the boundary claims to the boundary, and returns the result typed without them. Around `raf-effect-atom`'s `useAtomResult`, which returns typed failures and throws defects, that's `useAppBoundary(useAtomResult(issue, props.issue))`:

```sample
tanstack-start/src/docs/shared-boundaries.tsx#narrowed
```

It's a hook, called with the read it narrows, so it goes wherever the read goes. It throws when its boundary isn't mounted above the component:

```sample
tanstack-start/src/docs/shared-boundaries.tsx#mounted
```

A tag that none of `errors`' procedures can fail with is a type error:

```sample
tanstack-start/src/docs/shared-boundaries.tsx#misspelled
```

## Chained boundaries

`parent` puts a boundary under another one. A result passed to the child's hook throws the tags any boundary in the chain claims, each to the nearest boundary that claims it, and the claimed tags add up along the chain. Being signed out belongs to the app too, so `<AuthBoundary>` claims `Unauthorized` under `<AppBoundary>`, and `<IssueBoundary>` claims `IssueNotFound` under `<AuthBoundary>`:

```sample
tanstack-start/src/boundaries.tsx#auth
```

```sample
tanstack-start/src/boundaries.tsx#issue
```

`useIssueBoundary(useAtomResult(issue, props.issue))` throws `IssueNotFound` to `<IssueBoundary>`, `Unauthorized` to `<AuthBoundary>` and `RpcClientError` to `<AppBoundary>`. No failure is left, so the hook types the result as a success. `<IssueBoundary>` throws when `<AuthBoundary>` isn't mounted above it.

```demo
boundary-chain
```

## Matching is by tag

A shared boundary catches a claimed tag from any atom read under it, not only from the results passed to its hook. `reset` refreshes every atom in the registry whose failure has a tag the boundary handles, not only the one whose read threw: one outage fails every atom on the page, and one `reset` loads them all again.

## AtomHttpApi transport failures

The two clients report a failed connection differently. An `AtomRpc` query fails with `RpcClientError`, a typed failure, so `<AppBoundary>` claims it by tag and its `reset` retries it. An `AtomHttpApi` query turns [`HttpClientError`](https://github.com/Effect-TS/effect/blob/effect%404.0.6/packages/effect/src/http/HttpClientError.ts) (the request didn't reach the server, or the response had a status or body the client couldn't read) and a `SchemaError` (the answer didn't decode) into defects. Its error type lists only its endpoints' and middleware's errors, so a boundary's `catchTags` can't name these failures.

A defect skips the boundaries `createErrorBoundary` makes:

- A read through `useAtomResult` throws `Cause.squash(cause)` to the nearest other React error boundary, such as the route's [`errorComponent`](https://tanstack.com/router/latest/docs/framework/react/guide/data-loading#handling-errors-with-routeoptions-errorcomponent) or one the app mounts for defects.
- A loader's `ensure` or `fetch` rejects with it, and the router renders the route's `errorComponent`.
- To retry, refresh the atom before rendering it again, with `atoms.fetch(source, ...args)` or `registry.refresh`. The atom keeps the defect, and `ensure` returns it without a new request.

Keep these failures in that boundary. On the server, `createErrorBoundary` boundaries check typed failures only, and a defect reaches the browser without its `_tag`. A boundary that matched `HttpClientError` would render a fallback in the browser that the server didn't.

## Reads the hook narrows

The hook takes the `AsyncResult` of a read that returns typed failures and suspends while a failed atom refreshes: `raf-effect-atom`'s `useAtomResult`, or `useAtomSuspense(atom, { includeFailure: true, suspendOnWaiting: true })`. It throws a defect it's given too, to the nearest other React error boundary.

- A read that returns the old failure while `reset` refreshes the atom, such as Effect Atom's `useAtomValue`, hands the hook the claimed failure again. The hook throws it, and the boundary keeps its handler after the refresh succeeds.
- `useAtomSuspense` without `includeFailure` throws every failure itself, including the ones the boundaries leave, before the hook sees the result.
