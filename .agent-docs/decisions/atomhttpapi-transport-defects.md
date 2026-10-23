# AtomHttpApi transport failures stay defects (human chose; may revisit)

- **What Effect does:** `AtomHttpApi` turns `HttpClientError` and `SchemaError` into defects (`catchErrors` in `.repos/effect/packages/effect/src/reactivity/AtomHttpApi.ts`). So a query's error type is its endpoint's errors plus its middleware's, and `ErrorsOf` for an `AtomHttpApi` client lists those only.
- **Chosen (A): docs only.** The Shared boundaries page, in its "AtomHttpApi transport failures" section, explains:
  - where the defects go: the route's `errorComponent`, or a React error boundary the app mounts for defects;
  - how to retry: refresh the atom, because `ensure` returns the defect the atom still holds;
  - how this differs from `AtomRpc`, whose typed `RpcClientError` is claimed by `<AppBoundary>`.
- **Why:**
  - Boundaries see the same failures on the server and in the browser only because they claim typed failures. Server prerendering and `reset` use `Cause.findErrorOption`.
  - A defect crosses hydration through `Schema.Defect` as `{ name, message }`, which loses `_tag`.
- **Rejected for now:**
  - **(B) Boundaries claim defects by `_tag`,** and `ErrorsOf` adds `HttpClientError` for `AtomHttpApi` clients. The server and the browser would disagree about which boundary catches an error. The browser's catcher already matches a thrown tagged defect, but the server doesn't.
  - **(C) A combinator that maps transport defects back to typed failures.** It has the same hydration problem, unless the query's error schema also encodes `HttpClientError`, which means wrapping Effect's `AtomHttpApi`.
- **Revisit** B or C if the user asks, for example if KATT/executor keeps handling `HttpClientError` per component.
