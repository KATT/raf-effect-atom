---
title: Loader failures
description: A typed failure a loader hit on the server crosses to the browser as the same tagged error, where a boundary catches it or the loader turns it into a redirect.
section: Together
order: 1
---

`ensure` and `fetch` return a typed failure as a result instead of rejecting. A failure from the server reaches the browser as the same tagged error, decoded by the procedure's Schema, so there are two places to handle it.

## In a boundary

Let the route render and the read throw the failure to the boundary that claims it. The issue route reads `useIssueBoundary().wrap(issue(id))`, so `IssueNotFound` goes to `<IssueBoundary>`, `Unauthorized` to `<AuthBoundary>` and `RpcClientError` to `<AppBoundary>`:

```sample
tanstack-start/src/boundaries.tsx#issue
```

```sample
tanstack-start/src/routes/issues.$id.tsx#hero
```

The server renders the boundary's handler and sends the failed result with the page. The browser keeps the handler's HTML while it hydrates, then the read throws the hydrated failure and the boundary catches it, all without a request. `reset` refreshes the atom in the browser.

### During server rendering

React runs no error boundaries on the server: a read that throws there fails the response, or leaves that part of the page to the browser. So a boundary checks the registry before it renders its children, and renders its handler in their place for a failure it catches that has settled.

- `AtomErrorBoundary` reads its own atom, from the registry or from the state the page hydrated, under every framework.
- A shared boundary looks through the atoms that already ran in the registry it reads: the loaders' on TanStack Start, and on React Router, the request's under `HydrationBoundary`. A shared boundary above a route's `HydrationBoundary`, or in a Next.js client component, doesn't see them.
- A failure that settles after the boundary rendered, such as one a loader `prefetch`ed, streams to the browser instead.

A failure the boundary doesn't see is thrown on the server, and the browser renders the handler. On React Router, a throw before the page's shell is ready makes the response a 500.

## In the loader

When a failure should be the router's not-found page or a redirect, the loader reads the result's error:

```sample
tanstack-start/src/docs/loader-failures.tsx#not-found
```

The typed failure stays a value until the loader decides what it means. Only a defect or an interruption rejects, and goes to the router's error component.
