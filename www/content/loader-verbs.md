---
title: Loader verbs
description: prefetch, ensure and fetch start atoms from route loaders before anything renders, so a page's requests run at the same time instead of one after another.
section: raf-effect-atom
order: 1
---

When a component starts its own data, nested components wait for each other: a page with an issue, its assignee and its comments makes three requests one after another, a [request waterfall](./request-waterfalls.md). React's guidance is to start fetching before rendering, in the router's [loader](https://tanstack.com/router/latest/docs/framework/react/guide/data-loading). `raf-effect-atom` adds three verbs that start atoms there, in the registry the page renders from.

```sample
tanstack-start/src/docs/loader-verbs.ts#verbs
```

Each verb takes a source, an atom family or one atom, and the family's arguments: `atoms.ensure(issue, id)` starts `issue(id)`.

A source can be a derived atom with no serialization key that points at a serializable one with Effect's `initialValueTarget`, such as an [error boundary](./shared-boundaries.md#reading-a-wrapped-atom)'s `wrap(issue)`. The verbs start the atom it points at, the one [`useAtomResult`](./reading-atoms.md) reads it through: the lease, the handle's key and what the server sends are that atom's, and `ensure` and `fetch` wait for the derived atom's own result. The server sends a result still loading as a promise only when that atom holds an `AsyncResult`; one that holds another value, such as an `Option` snapshot, crosses with the value it has when the loaders finish, so point a derived atom at an `AsyncResult` atom, or `ensure` it.

To derive one, assign `initialValueTarget` to the atom it reads. [`Atom.map`](https://github.com/Effect-TS/effect/blob/effect%404.0.6/packages/effect/src/reactivity/Atom.ts) and `Atom.mapResult` set none, and `Atom.transform`'s `initialValueTarget` option follows the atom's own target to the end of its chain, which for an `AtomRpc` or `AtomHttpApi` query with `reactivityKeys` is an inner atom without a key:

```sample
tanstack-start/src/docs/loader-verbs.ts#derived
```

| Verb       | Starts the atom                          | Waits                             | When the atom has a result | Returns         |
| ---------- | ---------------------------------------- | --------------------------------- | -------------------------- | --------------- |
| `prefetch` | if it isn't in the registry              | never                             | leaves it alone            | a handle        |
| `ensure`   | if it isn't in the registry              | only while the atom has no result | returns it at once         | a loaded handle |
| `fetch`    | yes, and refreshes it if it has a result | until the new result settles      | refreshes it, then waits   | a loaded handle |

- Use `prefetch` for data the route needs but its loader doesn't: it streams in while the page renders.
- Use `ensure` when the loader needs the result, or the page shouldn't render without it.
- Use `fetch` when the loader must not see a result from before it ran, such as after a write.
- Use `prefetchInBrowser` for a read that needs what only the browser has, such as a token in the URL's fragment: the server leaves it to the browser. See [Inputs only the browser has](./request-waterfalls.md#inputs-only-the-browser-has).

Below, three copies of an app differ only in the verb their issue route's loader calls. The router keeps the old page until the loader returns, so a verb that waits blocks the navigation, and a page whose atom has no result yet shows a skeleton until it streams in.

```demo
loader-verbs
```

## Handles

A handle is plain data, the arguments and the atom's key, that names the atom a verb started. The loader returns it and the page passes it to the component that reads the atom, as a prop: `useAtomResult(issue, props.issue)` reads `issue(...props.issue.args)`. It crosses loader data and server component props as is. Its type names its source, so a component that takes a `Handle<typeof assignee>` can't be given an id or another family's handle, and can't start a request of its own. `ensure` and `fetch` return a `LoadedHandle`, for a component that should only get a handle whose atom had a result when the loader returned. See [Reading atoms](./reading-atoms.md#handles).

## Typed failures are results

`ensure` and `fetch` don't reject on a typed failure: they return a handle whose atom failed, so the loader can decide what the failure means, and otherwise the page renders it through a boundary. Only a defect or an interruption rejects. `Loader.result(handle)` returns the settled `AsyncResult` in the loader that waited for it; it throws for a copy of the handle, such as one read back from loader data.

The result's error type lists every tag the atom can fail with, so a loader can decide tag by tag. [`Match.valueTags`](https://github.com/Effect-TS/effect/blob/effect%404.0.6/packages/effect/src/Match.ts) takes one handler per tag, and doesn't compile when one is missing.

```sample
tanstack-start/src/docs/loader-verbs.ts#match
```

[Loader failures](./loader-failures.md) shows both: a `notFound` from the loader, and a failure caught by a boundary.

## Leases

A loader runs before the route renders, and an atom nobody has mounted is evicted when it goes idle. Every verb takes a lease, which keeps the atom mounted until a component reads it with `useAtomResult`, or for 30 seconds when none does. `Loader.make(registry, { leaseTTL })` changes the time.

## On the server

Each request has its own registry, so `ensure` waits like `fetch` and nothing refreshes in the background. Only atoms in the registry when the loaders finish are sent to the browser; an atom first read during render runs again there. Start every atom a page reads from its loader.

In development, a verb fails fast when a loader on the server starts an atom without a serialization key that doesn't point at one with `initialValueTarget`, since the browser would request it again.

## Aborted requests

When a navigation is left while its loaders wait, because another one interrupted it or the browser closed the request, `ensure` and `fetch` stop waiting and reject with the abort reason, which the router ignores. The atoms they started keep loading, in the browser's registry or until the request's registry is disposed. Nothing changes in the loaders:

- On React Router, the [middleware](https://reactrouter.com/how-to/middleware) `atomsMiddleware` gives the verbs the server request's [`signal`](https://developer.mozilla.org/en-US/docs/Web/API/Request/signal), and `clientAtomsMiddleware` gives client loaders the navigation's.
- On Next.js, the verbs take React's [`cacheSignal`](https://react.dev/reference/react/cacheSignal), which aborts with the server component render.
- Another integration passes its own: `Loader.make(registry, { signal })`.

On TanStack Router, the router context's `atoms` serves every navigation, so its verbs can't see one navigation's signal, and a loader waits until the atom settles. To stop waiting, run the Effect verbs with `run` and the loader's [abort signal](https://tanstack.com/router/latest/docs/framework/react/guide/data-loading#using-the-abort-signal):

```sample
tanstack-start/src/docs/loader-verbs.ts#signal
```

## In Effect code

The verbs are Effects that need an `AtomRegistry`. The framework integrations put them on the router context as Promises, through `Loader.make(registry)`, because loaders are async functions. Its `run` runs an Effect that needs the registry on the same registry, with the same lease and signal, and rejects with its failure: `raf-effect-atom/next` exports it as `run`.

```sample
tanstack-start/src/docs/loader-verbs.ts#effect
```
