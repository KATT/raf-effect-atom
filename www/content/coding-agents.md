---
title: For coding agents
description: What to write and what to avoid when a coding agent builds with raf-effect-atom and effect-atom-boundary, with the reason for each rule and the page that explains it.
section: Getting started
order: 4
---

These rules are for coding agents writing code with raf-effect-atom and effect-atom-boundary, and for the people reviewing that code. Each one keeps a page's requests starting before it renders, its results crossing from the server once, and its failures typed.

## Do

- **Start every atom before render.** Start it in the route's loader or the server component with the loader verbs (`atoms.prefetch(issue, id)`, `atoms.ensure(issue, id)`). See [Request waterfalls](./request-waterfalls.md).
- **Pass handles, not ids.** A component that reads an atom takes the handle its loader or server component returned, typed `Handle<typeof issue>`, and reads it with `useAtomResult(issue, props.issue)`. A component given an id can start the request as it renders. See [Handles](./reading-atoms.md#handles).
- **Put the state that picks data in the URL.** A page number, a filter, the selected item or a dialog that shows data goes in search params, or for a dialog in a route of its own (route masking, parallel routes), so the loader starts its atoms and links, reload and back work. See [Put the state in the URL](./request-waterfalls.md#put-the-state-in-the-url).
- **Start every atom before awaiting any.** In a loader, `prefetch` everything first, then `await` what the loader needs. Give [`Effect.all`](https://github.com/Effect-TS/effect/blob/effect%404.0.6/packages/effect/src/Effect.ts) a `concurrency`, or it runs its effects one after another. See [Start every atom before awaiting any](./request-waterfalls.md#start-every-atom-before-awaiting-any).
- **Read with `useAtomResult`.** It waits for a result the server is still streaming, keeps a hydrated one, and checks for waterfalls in development. See [Reading atoms](./reading-atoms.md).
- **Give every atom a loader starts a `serializationKey`.** Only serializable atoms cross from the server to the browser; without a key, the browser requests the atom again. See [Streaming and hydration](./hydration.md).
- **Start what browser-only inputs pick in a client-only route.** A token in the URL fragment or an OAuth callback never reaches the server. Make the route `ssr: false`, put the input in the router context from the browser's `getRouter`, and start the atom in the loader; it needs no `serializationKey`. Don't set the input in an atom from a `useEffect`. See [Inputs only the browser has](./request-waterfalls.md#inputs-only-the-browser-has).
- **Catch `RpcClientError` once, around the app.** Every procedure fails with it when the request doesn't reach the server or the answer doesn't decode. Claim it in a root `createErrorBoundary` whose handler offers `reset`, and chain the app's other boundaries under it with `parent`, so component reads are left with the contract's errors. An `AtomHttpApi` client makes its transport failures defects instead: leave them to the route's error component, not a `catchTags` handler. See [Shared boundaries](./shared-boundaries.md).
- **Handle each failure by its tag.** Catch tags in a boundary's `catchTags`, or check `_tag` on what's left in the component. One message for every failure hides which one happened. See [Error boundaries](./error-boundaries.md).
- **Keep `<WaterfallDetection mode="throw">` at the root.** In development, a read that starts an atom nothing started then throws to the nearest error boundary, naming the atom and the fix. Fix the cause the report names. See [Finding waterfalls in development](./request-waterfalls.md#finding-waterfalls-in-development).
- **Put a route's inputs in its URL.** An atom whose input comes from another atom's result waits for that result. Put the input in the path, or have the backend resolve the relation, before reaching for `useWaterfall`. See [Dependent atoms](./request-waterfalls.md#dependent-atoms).

## Avoid

- **Fetching in components.** No `useEffect` that calls the client or `registry.mount`, no `Effect.runPromise` in render, and no handle built by hand for an atom nothing starts. Each one requests only after the component renders.
- **Atom's own hooks on server data.** `useAtomValue` and `useAtomSuspense` neither wait for a result the server is still streaming nor keep a hydrated one, so the browser requests it again, and they skip the waterfall check.
- **Escape hatches for state the URL could hold.** Starting an atom in an event handler (`Loader.make(registry).prefetch`) or with `useWaterfall` is for state that shouldn't be in the URL, such as the keystrokes of a search-as-you-type box. Both start later than a loader would. See [Escape hatches](./request-waterfalls.md#escape-hatches).
- **`useWaterfall` to silence a report.** It's for an input that exists only in render, such as a debounced value, and each call is a round trip. If a loader or handler can know the input, start the atom there.
- **`mode="off"` or `mode="warn"` to get past a report.** The report is the waterfall: turning it off ships it.
- **`await` before the next start.** `await atoms.ensure(issue, id)` followed by `atoms.prefetch(assignee, id)` is two round trips; swap the lines and it's one.
- **Catch-all failure handling.** Don't branch on `error.message`, and don't render one message for a failure that can be several tags. The error type names every tag the read can fail with.
