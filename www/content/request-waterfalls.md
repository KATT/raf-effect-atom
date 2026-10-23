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

### Search as you type

A search box's text is URL state too. Keep it in a search param, start the search in the loader, and have the input replace the param:

```sample
tanstack-start/src/routes/search.tsx#search
```

Each keystroke navigates, and the loader starts the search for the text the URL holds. To search less often, debounce the [`navigate`](https://tanstack.com/router/latest/docs/framework/react/guide/navigation#usenavigate) call.

## Inputs only the browser has

Some reads need what only the browser has: a one-time token in the URL's fragment, a credential in `sessionStorage`, or a browser API such as [`navigator.permissions`](https://developer.mozilla.org/en-US/docs/Web/API/Permissions/query). A loader on the server can't start them, and starting them from a `useEffect` after hydration waits for that render.

`prefetchInBrowser(source, ...args)` starts them from the same loader as the rest of the page. In the browser it's `prefetch`. On the server it starts nothing and returns a handle marked to start in the browser: the server renders the page around the read and the nearest [Suspense](https://react.dev/reference/react/Suspense) boundary's fallback, and the browser's read starts the atom as it hydrates that boundary:

```sample
tanstack-start/src/docs/request-waterfalls.tsx#browser-only
```

- The atom reads what only the browser has inside its effect, so it needs no serialization key: the server never starts it, and the arguments the loader passes are what the URL holds.
- On client navigations the loader runs in the browser, so the request starts with the page's other atoms. After a server render it starts once the boundary hydrates, the earliest the browser can, and the waterfall check doesn't report it.
- Read it under a Suspense boundary. The server's read throws, so React renders the boundary's fallback and the browser renders the boundary; with no boundary around it, the server can't render the page. React reports the throw to the server's [`onError`](https://react.dev/reference/react-dom/server/renderToReadableStream#parameters) and the browser's [`onRecoverableError`](https://react.dev/reference/react-dom/client/hydrateRoot#parameters), as for any boundary the server leaves to the browser.
- On Next.js, a server component calls `prefetchInBrowser` from `raf-effect-atom/next` and passes the handle to a client component. On React Router, loaders call it on `atoms`, like the other verbs.

## Escape hatches

What's left is an input no loader can know: a choice a click or a submit makes that doesn't belong in the URL, or an id only a render finds.

### Event handlers

When a click or a submit picks the data, the handler starts the atom with `Loader.make(registry).prefetch`, which gives it the same verbs a loader has, and keeps the handle in state for the component that reads it. The request starts with the event, before the render that shows it, so it isn't a waterfall.

### Render-time inputs: useWaterfall

When an input exists only in render, such as an id a component reads from another atom's result, no loader or handler can start the atom. `useWaterfall(source, ...args)` starts it during render, like `prefetch`, and returns its handle, so the read looks like one fed by a loader:

```sample
tanstack-start/src/docs/request-waterfalls.tsx#use-waterfall
```

It starts the atom only if nothing has, so re-renders don't request it again, and it waits for a result the server is still streaming. Pass it the source a loader would, not a boundary's `wrap` of it: the wrapped atoms have no serialization key, so the server couldn't send them.

The name is the warning: each call is a round trip after the render that found the input. Search a codebase for `useWaterfall` and you have a list of its waterfalls. It isn't for typed input, where it would start a request for every value the input passes through: put that [in the URL](#search-as-you-type).

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
- Put the state that picks data in the URL: search params, a search box's text included, and routes for dialogs.
- Start every atom before awaiting any, and give `Effect.all` a `concurrency`.
- Shape data so a route's inputs come from the URL, not from other atoms.
- Start reads that need what only the browser has, such as a token in the URL's fragment, with `prefetchInBrowser` in the loader, and read them under Suspense.
- Start an atom a click or a submit picks in its handler, and one whose input only a render finds with `useWaterfall`, a known cost.
- Keep `<WaterfallDetection mode="throw">` in the root layout, so development finds the rest.
