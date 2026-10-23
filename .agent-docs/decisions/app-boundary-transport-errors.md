# Transport failures go to an app boundary (human chose)

- **`RpcClientError` is Effect RPC's transport failure** (the request didn't reach the server, or its answer didn't decode), the same for every procedure. It isn't a domain error, so components don't handle it inline.
- **The examples and docs mount an `AppBoundary`** (`createErrorBoundary` with `catchTags: { RpcClientError }`, a "can't reach the server" fallback and `reset` as `Try again`) at the root, as `AuthBoundary`'s `parent`. The reads under `IssueBoundary` and `AuthBoundary` are left with domain errors only, usually none.
- **The www demos fail a request on the client** (`dropNext` in the demo kit: `RequestLog`'s client middleware fails it with an `RpcClientError` whose reason is a `WorkerSendError`), so a reader can watch it climb to `<AppBoundary>` without stopping a server.
- **Domain errors stay visible and granular:** `IssueNotFound` at `IssueBoundary`, `Unauthorized` at `AuthBoundary`, each with its handler shown in the docs.
- **`useAtomResult` is typed as `AsyncResult.Success<A, never>` when no typed failure is left**, so a fully claimed read uses `result.value` without a dead failure branch.
- **Known gap:** one outage fails every atom on the page. `reset` refreshes the atom whose failure the boundary caught; a second atom whose failure arrived after the page unmounted doesn't load again (library bug, being fixed). The examples' recipe covers one failed atom until then.
- **Rejected:** a component-level `LoadFailed` per read (repeats one transport message in every component, and the user had to learn what `RpcClientError` is to read the snippets), and reloading the page from the fallback (loses the registry; `reset` is the boundary's retry).
