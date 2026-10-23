---
title: Reading atoms
description: useAtomResult reads an atom a loader started or the server streamed, waits for it under Suspense, and returns its typed failures.
section: raf-effect-atom
order: 3
---

Components read the atoms their loader started with `raf-effect-atom`'s `useAtomResult`. It suspends like [`useAtomSuspense`](https://github.com/Effect-TS/effect/tree/effect%404.0.6/packages/atom/react) until the atom has a result, and returns it:

```sample
tanstack-start/src/routes/issues.$id.tsx#component
```

## Failures

`useAtomResult(atom)` returns the settled result, typed failures included: check it with `AsyncResult.isFailure` or [`AsyncResult.match`](https://github.com/Effect-TS/effect/blob/effect%404.0.6/packages/effect/src/reactivity/AsyncResult.ts). A defect or an interruption isn't a typed failure: it throws `Cause.squash(cause)` to the error boundaries above.

To send some failures to an `effect-atom-boundary` boundary, read the atom its claims wrap: `useAtomResult(useIssueBoundary().wrap(issue(id)))` throws the claimed failures to their boundaries, as defects, and returns a result typed without them. When the boundaries claim every failure, as the issue route's do, no typed failure is left and the result is typed as a success: the component reads `result.value` without a check. `raf-effect-atom` doesn't import `effect-atom-boundary`.

While a failed atom refreshes, such as after a boundary's `reset`, the read suspends instead of returning the old failure again.

## What it adds to Atom's own read

- A result the server was still loading when it sent the page is awaited, not started, so the browser doesn't request it a second time.
- It reads through `Hydration.hydrated(atom)`, so a hydrated result is kept on the first read instead of running the atom's effect again.
- Once the component mounts, the loader's [lease](./loader-verbs.md#leases) ends and the component keeps the atom mounted.
- A derived atom that points at another with Effect's `initialValueTarget`, such as a boundary's wrapper, is read through that atom: the streamed result, the hydrated copy and the lease are the source's.

## On the server

Server rendering needs a registry per request, or one user's results would reach another. In development, `useAtomResult` throws during server rendering when the registry isn't a request registry. The framework integrations provide one; outside them, provide `RequestRegistry.make()` through `RegistryContext`.
