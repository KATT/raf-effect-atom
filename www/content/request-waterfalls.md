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

The fix is to start every atom the route reads in its loader. The component stays the same; it reads results that are already on their way:

```sample
tanstack-start/src/routes/issues.$id.tsx#route
```

Both requests start the moment the navigation does. With the router's [`defaultPreload: "intent"`](https://tanstack.com/router/latest/docs/framework/react/guide/preloading), they start when the user hovers the link.

On the server it matters twice. Only atoms in the registry when the loaders finish are sent to the browser, so an atom first read during render costs a round trip on the server and runs again in the browser.

In development, `useAtomResult` reports a read like `IssuePage`'s, which starts an atom nothing started: see [Finding waterfalls in development](#finding-waterfalls-in-development).

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

- **In the loader:** await the parent with `ensure` and start the child from its result. The navigation waits for both.
- **In a component:** start the child with `useWaterfall`, below. The rest of the page renders first.

## Event handlers

Data a user asks for, such as the next page of a list or a panel they open, starts in the event handler, before the state change that renders its reader. `Loader.make(registry)` gives a handler the same verbs a loader has:

```sample
tanstack-start/src/docs/request-waterfalls.tsx#event-handler
```

## Render-time inputs: useWaterfall

When an input exists only in render, such as an id from a list's result, no loader or handler can start the atom. `useWaterfall` starts it during render, like `prefetch`, and returns it, so the read looks like one fed by a loader:

```sample
tanstack-start/src/docs/request-waterfalls.tsx#use-waterfall
```

It starts the atom only if nothing has, so re-renders don't request it again, and it waits for a result the server is still streaming. Pass it the atom a loader would start, inside an error boundary's `wrap`: the wrapper has no serialization key, so the server couldn't send it.

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
raf-effect-atom: rendering read AtomRpc:GetIssueAssignee:1 before anything else had started it, so its request waits for this render: a request waterfall. Start it before render: in the route's loader or the server component (atoms.prefetch or atoms.ensure), or in the event handler that shows it (Loader.make(registry).prefetch). If its input is only known at render time, read it with useAtomResult(useWaterfall(atom)). https://raf-effect-atom.katt.dev/docs/request-waterfalls
```

Atoms a loader, a server component, an event handler or `useWaterfall` started aren't reported, and neither is a derived atom, such as a boundary's `wrap`, over one of those. The example apps use `"throw"`, so a component that forgets its loader breaks the page in development instead of shipping a waterfall.

Production builds don't check. The check sits behind `process.env.NODE_ENV !== "production"`, which bundlers replace at build time, so it's left out of the bundle.

## Code splitting

Lazy route components are another waterfall: the code has to download before it renders and finds out what to fetch. A route's loader is part of the route definition, not of the lazy component, so the router runs it while the component's code downloads.

## Summary

- Start atoms in loaders, server components and event handlers, never in render.
- Start every atom before awaiting any, and give `Effect.all` a `concurrency`.
- Shape data so a route's inputs come from the URL, not from other atoms.
- Use `useWaterfall` only when you can't, and treat each one as a known cost.
- Keep `<WaterfallDetection mode="throw">` in the root layout, so development finds the rest.
