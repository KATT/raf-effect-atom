---
title: Overview
description: Two thin layers on Effect Atom. Start atoms from route loaders and stream them to the browser, and catch their typed failures by tag in error boundaries.
section: Getting started
order: 1
---

This site documents two packages that add what [Effect Atom](https://github.com/Effect-TS/effect/tree/effect%404.0.6/packages/effect/src/reactivity) leaves to the app when its atoms call an [Effect RPC](https://github.com/Effect-TS/effect/tree/effect%404.0.6/packages/effect/src/rpc) backend from a server-rendered React app:

- **`effect-atom-boundary`**: typed error boundaries. A boundary catches an atom's failures by `_tag`, with a handler per tag typed by the error with that tag. It works with plain [`@effect/atom-react`](https://github.com/Effect-TS/effect/tree/effect%404.0.6/packages/atom/react).
- **`raf-effect-atom`**: render-as-you-fetch. Route loaders start atoms with `prefetch`, `ensure` or `fetch`, the server streams their results into the browser's registry, typed failures included, and components read them with `useAtomResult`.

Each works without the other. Together, a failure that happened on the server is caught in the browser by the boundary that claims its tag.

> [!NOTE]
> raf-effect-atom is early. Both packages can still change between minor releases.

## What a route looks like

```sample
tanstack-start/src/routes/issues.$id.tsx#hero
```

The loader starts both atoms before anything renders: it waits for the issue and lets the assignee stream in. The component reads the issue through `useIssueBoundary()`, so `IssueNotFound` renders the issue boundary's message, `Unauthorized` the app's sign-in boundary, and a request that doesn't reach the server the app boundary's. No failure is left, so the component renders the issue.

## Built for coding agents

Coding agents write what compiles and runs, so the setup makes the usual mistakes fail loudly. With `<WaterfallDetection mode="throw">`, a component that reads an atom no loader started throws in development, naming the atom and the fix. A boundary's `catchTags` keys come from the atom's error type, so a misspelled tag doesn't compile, and a failure the boundaries don't claim stays in the read's type, so a [`Match.valueTags`](https://github.com/Effect-TS/effect/blob/effect%404.0.6/packages/effect/src/Match.ts) over it that forgets a tag doesn't compile either. The agent is corrected by the tools, and [llms.txt](https://raf-effect-atom.katt.dev/llms.txt) starts with the rules on [For coding agents](./coding-agents.md).

## What Effect Atom already does

The registry is the cache: it dedupes, keeps atoms while they're mounted, evicts idle ones, refreshes on demand, and hydrates serializable atoms. [`AtomRpc`](https://github.com/Effect-TS/effect/blob/effect%404.0.6/packages/effect/src/reactivity/AtomRpc.ts) turns an RPC group into query and mutation atoms whose error types are the procedures' errors. These packages don't replace any of that. They add the two things Atom leaves out: starting atoms where React recommends, before render, and catching failures by type.

## Where to go next

- [Installation](./installation.md) and the [quick start](./quick-start.md).
- [Error boundaries](./error-boundaries.md), for `effect-atom-boundary` on its own.
- [Loader verbs](./loader-verbs.md), for `raf-effect-atom`.
- [Loader failures](./loader-failures.md), for both together.
- [For coding agents](./coding-agents.md), the patterns an agent should write and the ones to avoid.
