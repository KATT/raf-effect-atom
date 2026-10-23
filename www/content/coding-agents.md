---
title: For coding agents
description: What to write and what to avoid when a coding agent builds with raf-effect-atom and effect-atom-boundary, with the reason for each rule and the page that explains it.
section: Getting started
order: 4
---

These rules are for coding agents writing code with raf-effect-atom and effect-atom-boundary, and for the people reviewing that code. Each one keeps a page's requests starting before it renders, its results crossing from the server once, and its failures typed.

## Do

- **Start every atom before render.** Start it in the route's loader or the server component with the loader verbs (`atoms.prefetch`, `atoms.ensure`), or in the event handler that shows it with `Loader.make(registry).prefetch`. See [Request waterfalls](./request-waterfalls.md).
- **Start every atom before awaiting any.** In a loader, `prefetch` everything first, then `await` what the loader needs. Give [`Effect.all`](https://github.com/Effect-TS/effect/blob/effect%404.0.6/packages/effect/src/Effect.ts) a `concurrency`, or it runs its effects one after another. See [Start every atom before awaiting any](./request-waterfalls.md#start-every-atom-before-awaiting-any).
- **Read with `useAtomResult`.** It waits for a result the server is still streaming, keeps a hydrated one, and checks for waterfalls in development. See [Reading atoms](./reading-atoms.md).
- **Give every atom a loader starts a `serializationKey`.** Only serializable atoms cross from the server to the browser; without a key, the browser requests the atom again. See [Streaming and hydration](./hydration.md).
- **Catch `RpcClientError` once, around the app.** Every procedure fails with it when the request doesn't reach the server or the answer doesn't decode. Claim it in a root `createErrorBoundary` whose handler offers `reset`, and chain the app's other boundaries under it with `parent`, so component reads are left with the contract's errors. See [Shared boundaries](./shared-boundaries.md).
- **Handle each failure by its tag.** Catch tags in a boundary's `catchTags`, or check `_tag` on what's left in the component. One message for every failure hides which one happened. See [Error boundaries](./error-boundaries.md).
- **Keep `<WaterfallDetection mode="throw">` at the root.** In development, a read that starts an atom nothing started then throws to the nearest error boundary, naming the atom and the fix. Fix the cause the report names. See [Finding waterfalls in development](./request-waterfalls.md#finding-waterfalls-in-development).
- **Put a route's inputs in its URL.** An atom whose input comes from another atom's result waits for that result. Put the input in the path, or have the backend resolve the relation, before reaching for `useWaterfall`. See [Dependent atoms](./request-waterfalls.md#dependent-atoms).

## Avoid

- **Fetching in components.** No `useEffect` that calls the client or `registry.mount`, no `Effect.runPromise` in render, and no `useAtomResult` on an atom nothing starts. Each one requests only after the component renders.
- **Atom's own hooks on server data.** `useAtomValue` and `useAtomSuspense` neither wait for a result the server is still streaming nor keep a hydrated one, so the browser requests it again, and they skip the waterfall check.
- **`useWaterfall` to silence a report.** It's for an input that exists only in render, such as an id from a list's result, and each call is a round trip. If a loader or handler can know the input, start the atom there.
- **`mode="off"` or `mode="warn"` to get past a report.** The report is the waterfall: turning it off ships it.
- **`await` before the next start.** `await atoms.ensure(issue(id))` followed by `atoms.prefetch(assignee(id))` is two round trips; swap the lines and it's one.
- **Catch-all failure handling.** Don't branch on `error.message`, and don't render one message for a failure that can be several tags. The error type names every tag the read can fail with.
