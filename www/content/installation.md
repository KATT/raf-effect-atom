---
title: Installation
description: Install one package or both, with Effect, Effect Atom's React bindings and React as peers.
section: Getting started
order: 2
---

Both packages need [Effect](https://github.com/Effect-TS/effect/tree/effect%404.0.6/packages/effect) and [`@effect/atom-react`](https://github.com/Effect-TS/effect/tree/effect%404.0.6/packages/atom/react) 4.0.6 or later, and React 19, as peer dependencies. Hydration relies on the registry's `skipInitialRun`, which Effect's registry reads from 4.0.6 on: with an older Effect, an atom the server sent runs again on its first read in the browser, which can render something other than the server's HTML: a [hydration mismatch](https://react.dev/errors/418).

## Typed error boundaries only

```bash
pnpm add effect-atom-boundary effect @effect/atom-react react
```

## Loaders and streaming, with boundaries

```bash
pnpm add raf-effect-atom effect-atom-boundary effect @effect/atom-react react
```

The packages don't depend on each other: `raf-effect-atom`'s `useAtomResult` reads an atom a boundary's hook returns like any other. The framework integrations are subpath exports of `raf-effect-atom`, such as `raf-effect-atom/tanstack-router`, so there's nothing else to install.
