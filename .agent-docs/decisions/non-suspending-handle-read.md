# A read without Suspense is `useHandleValue(source, handle)`

- **Problem:** KATT/executor's `useStartedQuery` renders every state of a read itself, so it reads with `useAtomValue`. That leaves the loader's lease running, a later prefetch takes it again, and the atom stays mounted past the component. `useAtomResult` doesn't fit, because it suspends on a `waiting` failure and throws defects.
- **Chosen: a second read hook, `useHandleValue(source, handle)`,** next to `useAtomResult`, like TanStack Query's `useQuery` next to `useSuspenseQuery` and Effect's `useAtomValue` next to `useAtomSuspense`.
  - It returns the atom's current `AsyncResult` as it is: `Initial` while it loads, failures `waiting` while they refresh, and defects as failures.
  - It shares `useAtomResult`'s plumbing: the hydrated copy, the atom a derived source points at, the handle-key and waterfall checks, and ending the lease after it subscribes.
  - It returns `Initial`, without reading the atom, while a streamed result is pending, so the browser doesn't request it twice, and for a `prefetchInBrowser` handle on the server.
- **Rejected:**
  - **Exporting `release` from `internal/leases`.** It makes the lease a public concept, and a caller that ends it before subscribing lets the atom be evicted between the two. Executor would also still have to redo the stream and hydration handling.
  - **An option on `useAtomResult`,** like `{ suspend: false }`. The return type changes with it (`Initial` and defects become possible), so it's a different contract behind one name, and the option has to be threaded through the boundary hooks' types.
- **Revisit** if apps need a lower-level piece, such as subscribing to a handle without reading it.
