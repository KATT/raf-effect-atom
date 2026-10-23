---
title: Loader verbs
description: prefetch, ensure and fetch start atoms from route loaders before anything renders, so a page's requests run at the same time instead of one after another.
section: raf-effect-atom
order: 1
---

When a component starts its own data, nested components wait for each other: a page with an issue, its assignee and its comments makes three requests one after another. React's guidance is to start fetching before rendering, in the router's [loader](https://tanstack.com/router/latest/docs/framework/react/guide/data-loading). `raf-effect-atom` adds three verbs that start atoms there, in the registry the page renders from.

```sample
tanstack-start/src/docs/loader-verbs.ts#verbs
```

| Verb       | Starts the atom                          | Waits                             | When the atom has a result | Returns            |
| ---------- | ---------------------------------------- | --------------------------------- | -------------------------- | ------------------ |
| `prefetch` | if it isn't in the registry              | never                             | leaves it alone            | nothing            |
| `ensure`   | if it isn't in the registry              | only while the atom has no result | returns it at once         | the settled result |
| `fetch`    | yes, and refreshes it if it has a result | until the new result settles      | refreshes it, then waits   | the settled result |

- Use `prefetch` for data the route needs but its loader doesn't: it streams in while the page renders.
- Use `ensure` when the loader needs the result, or the page shouldn't render without it.
- Use `fetch` when the loader must not see a result from before it ran, such as after a write.

Below, three copies of an app differ only in the verb their issue route's loader calls. The router keeps the old page until the loader returns, so a verb that waits blocks the navigation, and a page whose atom has no result yet shows a skeleton until it streams in.

```demo
loader-verbs
```

## Typed failures are results

`ensure` and `fetch` don't reject on a typed failure: they return the `AsyncResult`, so the loader can decide what a failure means, and otherwise the page renders it through a boundary. Only a defect or an interruption rejects.

The result's error type lists every tag the atom can fail with, so a loader can decide tag by tag. [`Match.valueTags`](https://github.com/Effect-TS/effect/blob/effect%404.0.6/packages/effect/src/Match.ts) takes one handler per tag, and doesn't compile when one is missing.

```sample
tanstack-start/src/docs/loader-verbs.ts#match
```

[Loader failures](./loader-failures.md) shows both: a `notFound` from the loader, and a failure caught by a boundary.

## Leases

A loader runs before the route renders, and an atom nobody has mounted is evicted when it goes idle. Every verb takes a lease, which keeps the atom mounted until a component reads it with `useAtomResult`, or for 30 seconds when none does. `Loader.make(registry, { leaseTTL })` changes the time.

## On the server

Each request has its own registry, so `ensure` waits like `fetch` and nothing refreshes in the background. Only atoms in the registry when the loaders finish are sent to the browser; an atom first read during render runs again there. Start every atom a page reads from its loader.

In development, a verb fails fast when a loader on the server starts an atom without a serialization key, since the browser would request it again.

## In Effect code

The verbs are Effects that need an `AtomRegistry`. The framework integrations put them on the router context as Promises, through `Loader.make(registry)`, because loaders are async functions.

```sample
tanstack-start/src/docs/loader-verbs.ts#effect
```
