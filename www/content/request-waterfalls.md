---
title: Request waterfalls
description: What a request waterfall is, why starting atoms in components causes one, and how loaders, routes and backends remove them.
section: raf-effect-atom
order: 2
---

A request waterfall is a request that can't start until another one has finished. Each level costs a full round trip, and on a slow connection a round trip can take hundreds of milliseconds. Removing waterfalls is usually the most effective thing you can do for a page's loading time.

`raf-effect-atom` is built around this. Route loaders start atoms before anything renders, when everything the page needs is known from the URL, so the requests start together:

```
1. |-> GetIssue
1. |-> GetIssueAssignee
1. |-> ListComments
```

instead of one after another, as each component renders and finds out what it needs:

```
1. |-> GetIssue
2.   |-> GetIssueAssignee
3.     |-> ListComments
```

Below, two copies of a page read the same three atoms. One route's loader starts them; the other has no loader, so each component starts its own atom when it renders.

```demo
waterfalls
```

## Fetch-on-render

The classic waterfall comes from starting data where it's used. [Effect Atom](https://github.com/Effect-TS/effect/tree/effect%404.0.6/packages/effect/src/reactivity)'s registry runs an atom's effect the first time anything reads it, so a component that reads an atom nothing started starts the request itself. It suspends, and its children, which read their own atoms, render only once its result is in:

```sample
tanstack-start/src/docs/request-waterfalls.tsx#fetch-on-render
```

[Suspense](https://react.dev/reference/react/Suspense) makes this worse, not better: a suspended component renders nothing below it, so its children can't even start their requests.

The fix is to start every atom the route reads in its loader. The component stays the same; it reads results that are already on their way:

```sample
tanstack-start/src/routes/issues.$id.tsx#route
```

Both requests start the moment the navigation does. With the router's [`defaultPreload: "intent"`](https://tanstack.com/router/latest/docs/framework/react/guide/preloading), they start when the user hovers the link.

On the server it matters twice. Only atoms in the registry when the loaders finish are sent to the browser, so an atom first read during render costs a round trip on the server and runs again in the browser.

## Start every atom before awaiting any

Inside a loader, order matters. An `await` before a `prefetch` turns two parallel requests back into a waterfall:

```sample
tanstack-start/src/docs/request-waterfalls.tsx#await-first
```

Start what streams first, then wait for what the page can't render without:

```sample
tanstack-start/src/docs/request-waterfalls.tsx#start-first
```

When the loader needs several results, start them together and await them together:

```sample
tanstack-start/src/docs/request-waterfalls.tsx#await-both
```

In Effect code, [`Effect.all`](https://github.com/Effect-TS/effect/blob/effect%404.0.6/packages/effect/src/Effect.ts) runs its effects one after another unless it's given a `concurrency`. Typed failures stay in each result, so the loader still decides tag by tag:

```sample
tanstack-start/src/docs/request-waterfalls.tsx#effect-all
```

## Dependent atoms

An atom whose input comes from another atom's result is a waterfall by construction: the loader has to await the first before it can start the second. Fix it where the data is shaped, so every atom a route reads can start from what the URL holds:

- **Put the input in the route.** If the page is about an organization, its id belongs in the path (`/orgs/$orgId`), not in a lookup on the current user. Links into the page come from places that already know it.
- **Have the backend resolve it.** The server already knows the relations. The example contract's `GetIssueAssignee` takes the issue's id, not the user's, so a loader starts it beside `GetIssue` instead of waiting for the issue's `assigneeId`.

When the data really can't be reshaped, such as a third-party API, the loader awaits the parent with `ensure` and starts the child from its result. The navigation waits for both, but the waterfall is in one place you can see.

## Code splitting

Lazy route components are another waterfall: the code has to download before it renders and finds out what to fetch. A route's loader is part of the route definition, not of the lazy component, so the router runs it while the component's code downloads.

## Summary

- Start atoms in loaders and server components, never in render.
- Start every atom before awaiting any, and give `Effect.all` a `concurrency`.
- Shape data so a route's inputs come from the URL, not from other atoms.
