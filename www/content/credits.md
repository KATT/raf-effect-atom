---
title: Credits
description: raf-effect-atom builds on Effect Atom and Effect RPC, takes its boundaries from result-rpc, and its loaders from raf-query.
section: Project
order: 1
---

## Effect

Both packages are thin layers on [Effect](https://github.com/Effect-TS/effect/tree/effect%404.0.6/packages/effect): Effect Atom's registry is the cache, [`AtomRpc`](https://github.com/Effect-TS/effect/blob/effect%404.0.6/packages/effect/src/reactivity/AtomRpc.ts) makes the query atoms, and Effect RPC's Schemas carry typed failures from the server to the browser. Thanks to the Effect team.

## result-rpc

The typed error boundaries are [result-rpc](https://result-rpc.com/)'s idea: its [Shells](https://result-rpc.com/concepts/shells/) are error boundaries that claim failure classes and remove them from the component's error type. `effect-atom-boundary` is that idea over Effect Atom, claiming by `_tag`.

## raf-query

The loader verbs, `prefetch`, `ensure` and `fetch`, and the way results stream from loaders into the browser, come from [raf-query](https://github.com/KATT/raf-query), a render-as-you-fetch cache for React. So do this site, its live demos and its docs tooling.

## TanStack

The router integration and this site run on [TanStack Router](https://tanstack.com/router/latest) and [TanStack Start](https://tanstack.com/start/latest).
