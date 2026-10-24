---
title: Reading atoms
description: useAtomResult reads an atom a loader started or the server streamed, waits for it under Suspense, and returns its typed failures.
section: raf-effect-atom
order: 3
---

Components read the atoms their loader started with `raf-effect-atom`'s `useAtomResult(source, handle)`. It takes the source the loader passed to its verb and the [handle](./loader-verbs.md#handles) the verb returned, suspends like [`useAtomSuspense`](https://github.com/Effect-TS/effect/tree/effect%404.0.6/packages/atom/react) until the atom has a result, and returns it:

```sample
tanstack-start/src/routes/issues.$id.tsx#component
```

## Handles

A component that reads an atom takes its handle as a prop, not the id it was built from. A component given an id could build the atom and start the request as it renders; given a handle, it reads a request a loader, a server component or an event handler already started. The handle's type names its source, so `Handle<typeof assignee>` takes no id and no other family's handle.

A handle is plain data, so it goes through loader data and server component props unchanged. In development, `useAtomResult` throws when the atom the source makes from the handle's arguments has a different key from the handle's, such as a handle passed with the wrong source.

An event handler makes a handle with `Loader.make(registry).prefetch(source, ...args)`, and keeps it in state for the component that reads it. A value that exists only in render, such as an id read from another atom's result, gets one from [`useWaterfall`](./request-waterfalls.md#render-time-inputs-usewaterfall).

## Failures

`useAtomResult(source, handle)` returns the settled result, typed failures included: check it with `AsyncResult.isFailure` or [`AsyncResult.match`](https://github.com/Effect-TS/effect/blob/effect%404.0.6/packages/effect/src/reactivity/AsyncResult.ts). A defect or an interruption isn't a typed failure: it throws `Cause.squash(cause)` to the error boundaries above.

To send some failures to an `effect-atom-boundary` boundary, pass the result to its hook: `useIssueBoundary(useAtomResult(issue, props.issue))` throws the claimed failures to their boundaries and returns the result typed without them. When the boundaries claim every failure, as the issue route's do, no typed failure is left and the result is typed as a success: the component reads `result.value` without a check. `raf-effect-atom` doesn't import `effect-atom-boundary`.

While a failed atom refreshes, such as after a boundary's `reset`, the read suspends instead of returning the old failure again.

## What it adds to Atom's own read

- A result the server was still loading when it sent the page is awaited, not started, so the browser doesn't request it a second time.
- It reads through `Hydration.hydrated(atom)`, so a hydrated result is kept on the first read instead of running the atom's effect again.
- Once the component mounts, the loader's [lease](./loader-verbs.md#leases) ends and the component keeps the atom mounted.
- A derived atom that points at another with Effect's `initialValueTarget` is read through that atom: the streamed result, the hydrated copy and the lease are the source's.

## On the server

Server rendering needs a registry per request, or one user's results would reach another. In development, `useAtomResult` and `HydrationBoundary` throw during server rendering when the registry isn't a request registry, such as [`@effect/atom-react`](https://github.com/Effect-TS/effect/tree/effect%404.0.6/packages/atom/react)'s default one, which every request shares. The framework integrations provide one; outside them, provide `RequestRegistry.make()` through `RegistryContext`.
