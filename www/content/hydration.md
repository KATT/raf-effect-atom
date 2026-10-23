---
title: Streaming and hydration
description: How the server's registry reaches the browser, with results still loading crossing as promises and typed failures decoded by Schema.
section: raf-effect-atom
order: 3
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

## Without a router integration

Where the server's state reaches React as a prop, such as a server component's props, `HydrationBoundary` from `raf-effect-atom` hydrates it while rendering: `<HydrationBoundary state={state}>`.
