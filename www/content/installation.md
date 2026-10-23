---
title: Installation
description: Install one package or both, with Effect, Effect Atom's React bindings and React as peers.
section: Getting started
order: 2
---

Both packages need [Effect](https://github.com/Effect-TS/effect/tree/effect%404.0.6/packages/effect) 4, [`@effect/atom-react`](https://github.com/Effect-TS/effect/tree/effect%404.0.6/packages/atom/react) and React 19 as peer dependencies.

## Typed error boundaries only

```bash
pnpm add effect-atom-boundary effect @effect/atom-react react
```

## Loaders and streaming, with boundaries

```bash
pnpm add raf-effect-atom effect-atom-boundary effect @effect/atom-react react
```

The packages don't depend on each other: `raf-effect-atom`'s `useAtomResult` reads an atom a boundary's hook returns like any other. The framework integrations are subpath exports of `raf-effect-atom`, such as `raf-effect-atom/tanstack-router`, so there's nothing else to install.
