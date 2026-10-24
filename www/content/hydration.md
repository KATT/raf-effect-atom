---
title: Streaming and hydration
description: How the server's registry reaches the browser, with results still loading crossing as promises and typed failures decoded by Schema.
section: raf-effect-atom
order: 4
---

On the server, each request renders from its own registry. Once the loaders have started their atoms, `Hydration.dehydrate(registry)` encodes every serializable atom in it:

- A settled result crosses as its encoded value.
- A result still loading crosses as a promise that resolves when it settles, carried by the framework's own streaming, such as TanStack Router's dehydrated state.

In the browser, `Hydration.hydrate(registry, state)` applies the settled values at once and holds each streamed result until its promise resolves. `useAtomResult` waits for a held result instead of starting the atom, so nothing is requested twice. The [framework integrations](./tanstack-start.md) call both for you.

Below, the server is a request registry with its own worker. Its loaders wait for the issue and start the assignee without waiting, so the issue crosses with the page and the assignee streams in after it.

```demo
hydration
```

## Serialization keys

Only serializable atoms cross. An `AtomRpc` query is serializable when it's given a `serializationKey`, which must be unique for the procedure:

```sample
tanstack-start/src/issues.ts#atoms
```

An atom without one runs again in the browser. In development, the loader verbs fail fast on the server when a loader starts one.

## Typed failures survive

A serializable query encodes its whole `AsyncResult` with the procedure's Schemas, its `Cause` included. A server-side `IssueNotFound` decodes as an `IssueNotFound` in the browser, with its fields, so a boundary there catches it by tag. See [Loader failures](./loader-failures.md).

## Hydrating without running again

[Effect Atom's hydration](https://github.com/Effect-TS/effect/blob/effect%404.0.6/packages/effect/src/reactivity/Hydration.ts) seeds an atom's value, but an effect atom still runs its effect when it mounts, so every result the server rendered would be requested again. `Hydration.hydrated(atom)` returns a copy of a serializable atom that keeps its hydrated value on the first read. The loader verbs and `useAtomResult` read through it; use it yourself to read a hydrated atom with `@effect/atom-react`'s own hooks, such as `useAtomValue(Hydration.hydrated(issue(1)))`.

## Boundaries that hydrate after the page's effects

React hydrates each [Suspense](https://react.dev/reference/react/Suspense) boundary once its HTML and its code have arrived, so a boundary around a streamed result can hydrate after the components around it have hydrated and run their effects. Its first render in the browser still has to match the server's HTML, or React reports a [hydration mismatch](https://react.dev/errors/418) and renders the boundary again in the browser:

- An atom it reads gives the registry's current value. An effect outside the boundary that refreshes or sets that atom can change what the boundary renders when it hydrates.
- State the browser keeps outside React, such as whether the document has painted, has the same problem when the boundary reads it in its first render. [`useSyncExternalStore`](https://react.dev/reference/react/useSyncExternalStore#adding-support-for-server-rendering)'s server snapshot is what React uses for every component it hydrates, so it tells a hydrating component from one that mounts later:

```sample
tanstack-start/src/docs/hydration.tsx#late-boundary
```

## HydrationBoundary

Where the server's state reaches React through rendering rather than a router, `HydrationBoundary` from `raf-effect-atom` hydrates it. Apps import the same component everywhere; it does what the code around it can:

- In a [server component](https://react.dev/reference/rsc/server-components), pass the request's registry: `<HydrationBoundary registry={getRegistry()}>`, with `getRegistry` from `raf-effect-atom/rsc`. Server components get their own build of `HydrationBoundary` through the package's `react-server` [export condition](https://nodejs.org/api/packages.html#conditional-exports), which every React Server Components bundler resolves. It waits for the registry's seed, dehydrates the atoms started so far, and sends them with the server component's payload, so results still loading stream in as they settle.
- Anywhere else, such as a React Router route component, pass the state a loader dehydrated: `<HydrationBoundary state={loaderData.atoms}>`. A registry can't cross to the browser, so `registry` throws outside server components.

Both write into the browser's registry, which `RegistryProvider` from `raf-effect-atom` holds at the root.
