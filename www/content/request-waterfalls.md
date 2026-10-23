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

Below, two copies of a page read the same three atoms. One route's loader starts them; the other has no loader, so each component starts its own atom when it renders, with [`useWaterfall`](#render-time-inputs-usewaterfall).

```demo
waterfalls
```

## Fetch-on-render

The classic waterfall comes from starting data where it's used. [Effect Atom](https://github.com/Effect-TS/effect/tree/effect%404.0.6/packages/effect/src/reactivity)'s registry runs an atom's effect the first time anything reads it, so a component that reads an atom nothing started starts the request itself. It suspends, and its children, which read their own atoms, render only once its result is in:

```sample
tanstack-start/src/docs/request-waterfalls.tsx#fetch-on-render
```

[Suspense](https://react.dev/reference/react/Suspense) makes this worse, not better: a suspended component renders nothing below it, so its children can't even start their requests.

The fix is to start every atom the route reads in its loader and pass the [handles](./loader-verbs.md#handles) it returns down to the components. A component reads a result that's already on its way, and since it takes a handle instead of an id, it can't start a request of its own:

```sample
tanstack-start/src/routes/issues.$id.tsx#route
```

Both requests start the moment the navigation does. With the router's [`defaultPreload: "intent"`](https://tanstack.com/router/latest/docs/framework/react/guide/preloading), they start when the user hovers the link.

On the server it matters twice. Only atoms in the registry when the loaders finish are sent to the browser, so an atom first read during render costs a round trip on the server and runs again in the browser.

In development, `useAtomResult` also reports a read that starts an atom nothing started, such as through a handle built by hand: see [Finding waterfalls in development](#finding-waterfalls-in-development).

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

When the data really can't be reshaped, such as a third-party API, you have two options, and both pay the extra round trip:

- **In the loader:** await the parent with `ensure` and start the child from its result, which [`Loader.result`](./loader-verbs.md#typed-failures-are-results) returns. The navigation waits for the parent, and the child streams in or waits too, as its verb says.
- **In a component:** start the child with [`useWaterfall`](#render-time-inputs-usewaterfall), an escape hatch. The rest of the page renders first.

```sample
tanstack-start/src/docs/request-waterfalls.tsx#dependent
```

## Put the state in the URL

Loaders start what the URL names. The example apps' issue list keeps its status filter and sort order in search params, so its loader starts the matching page, and a filtered list survives a reload or a shared link.

> [!TIP]
> A page number, a filter, the selected item or a dialog that shows data goes in the URL: in search params ([TanStack Router](https://tanstack.com/router/latest/docs/framework/react/guide/search-params), [Next.js](https://nextjs.org/docs/app/api-reference/file-conventions/page#searchparams-optional), [React Router](https://reactrouter.com/api/hooks/useSearchParams)), or for a dialog, in a route of its own, shown over the page with [route masking](https://tanstack.com/router/latest/docs/framework/react/guide/route-masking) in TanStack Router or [parallel](https://nextjs.org/docs/app/api-reference/file-conventions/parallel-routes#modals) and [intercepting routes](https://nextjs.org/docs/app/api-reference/file-conventions/intercepting-routes) in Next.js. The loader then starts its atoms with the page's, and a link opens it, a reload keeps it and the back button closes it.

## Escape hatches

What's left is state that shouldn't be in the URL, such as each keystroke in a search box. Two escape hatches start its atoms, and both start the request later than a loader would.

### Event handlers

When an event handler changes the state that picks the data, it can start the atom before the state change that renders its reader. `Loader.make(registry)` gives a handler the same verbs a loader has, so a click or a submit calls `prefetch` in its handler. Search-as-you-type debounces instead: the URL can hold a submitted query, but not every keystroke, so a timer starts each search once the typing stops:

```sample
tanstack-start/src/docs/request-waterfalls.tsx#event-handler
```

The timer starts after the render that shows the keystroke, so the request starts after a render, but before the one that renders its reader. The effect's cleanup resets the timer on each keystroke and on unmount, and the transition keeps the previous results on screen until the next ones are in.

### Render-time inputs: useWaterfall

When an input exists only in render, such as a value a hook debounces, no loader or handler can start the atom. `useWaterfall(source, ...args)` starts it during render, like `prefetch`, and returns its handle, so the read looks like one fed by a loader:

```sample
tanstack-start/src/docs/request-waterfalls.tsx#use-waterfall
```

It starts the atom only if nothing has, so re-renders don't request it again, and it waits for a result the server is still streaming. Pass it the source a loader would, not a boundary's `wrap` of it: the wrapped atoms have no serialization key, so the server couldn't send them.

The name is the warning: each call is a round trip after the render that found the input. Search a codebase for `useWaterfall` and you have a list of its waterfalls.

## Finding waterfalls in development

In development, `useAtomResult` checks every read: when the atom it reads has no node in the registry, no hydrated value and no result streaming in, the read is about to start it in render. `WaterfallDetection` in the root layout sets what it does then:

```sample
tanstack-start/src/routes/__root.tsx#root
```

| `mode`    | When a read starts an atom nothing started                         |
| --------- | ------------------------------------------------------------------ |
| `"warn"`  | `console.warn` once per atom, naming it. The default.              |
| `"throw"` | Throws to the nearest error boundary, so the page can't be missed. |
| `"off"`   | Nothing.                                                           |

The report names the atom and how to fix it:

```text
raf-effect-atom: rendering read AtomRpc:GetIssueAssignee:1 before anything else had started it, so its request waits for this render: a request waterfall. Start it before render and pass its handle down, from the route's loader or the server component (atoms.prefetch(source, ...args) or atoms.ensure). If the state that picks it, such as a page, a filter or an open dialog, isn't in the URL, put it there so the loader can. As escape hatches for state that can't be in the URL: start it in the event handler that changes the state (Loader.make(registry).prefetch), or, if its input only exists in render, read it with useAtomResult(source, useWaterfall(source, ...args)). https://raf-effect-atom.katt.dev/docs/request-waterfalls
```

Atoms a loader, a server component, an event handler or `useWaterfall` started aren't reported, and neither is a derived atom, such as a boundary's `wrap`, over one of those. The example apps use `"throw"`, so a component that forgets its loader breaks the page in development instead of shipping a waterfall.

Production builds don't check. The check sits behind `process.env.NODE_ENV !== "production"`, which bundlers replace at build time, so it's left out of the bundle.

## Code splitting

Lazy route components are another waterfall: the code has to download before it renders and finds out what to fetch. A route's loader is part of the route definition, not of the lazy component, so the router runs it while the component's code downloads.

## Summary

- Start atoms in loaders and server components, never in render, and pass their handles to the components that read them.
- Put the state that picks data in the URL: search params, and routes for dialogs.
- Start every atom before awaiting any, and give `Effect.all` a `concurrency`.
- Shape data so a route's inputs come from the URL, not from other atoms.
- For state that can't be in the URL, start atoms in the event handler that changes it, or with `useWaterfall`, and treat each one as a known cost.
- Keep `<WaterfallDetection mode="throw">` in the root layout, so development finds the rest.
