# Module state is keyed by what one request owns (agent)

- **Rule:** module-scope mutable state in `packages/` is either:
  - a `WeakMap` or `WeakSet` keyed by an object one request owns (its `AtomRegistry`, a registry node, a handle, a dehydrated array), or
  - a cache of request-independent definitions (atoms, boundary components).
- **Never:** a module-level `Map`, `Set`, counter or singleton that holds request data, a `globalThis` write, or a weak map keyed by a value two requests can share, such as an error object a module creates once. Import-time side effects stay out too: both packages declare `"sideEffects": false`.
- **Why:** a server renders overlapping requests in one process. State keyed by a shared value carries one request's data, or the target of its `reset`, into another, and pins the request's registry. State keyed by a per-request object goes away with the request.
- **Fixed in the audit:**
  - `effect-atom-boundary`'s failed reads were one `WeakMap<error, { atom, registry }>`. Two registries failing with one error object kept only the last record, so the other boundary's `reset` refreshed the wrong registry. It's now `WeakMap<AtomRegistry, WeakMap<error, atom>>`, read and reset in the boundary's own registry (`src/internal/failedReads.ts`).
  - raf's `HydrationBoundary` hydrated into whatever registry the context gave on the server, including `@effect/atom-react`'s module-level default, which every request shares. In development it now throws there, as `useAtomResult` does (`requireRequestRegistry` in `src/internal/registry.ts`).
- **Judged safe:**
  - Keyed per request: `RequestRegistry`'s marks, leases, pending and streamed results, seeds, `sources`, waterfall warnings (per registry) and errors (per node), `Loader.result`'s results (per handle object).
  - Definitions only: `Hydration.hydrated`'s copies (atom to copy), `wrap`'s per-boundary atom and family memos, `createErrorBoundary`'s component internals, `ModeContext`, `LeaseTTL`, and the never-resolving promise `Prerendered` suspends on, which only the browser renders.
  - Per request through React: `raf-effect-atom/rsc`'s `React.cache` registry.
  - Browser only: `internal/registry.ts`'s `mounted` registry for `clientAtomsMiddleware`, set from `RegistryProvider`'s effect, which never runs on the server.
- **Limits accepted:**
  - The request-registry guards are development-only, like `useAtomResult`'s, so production pays nothing for them.
  - `RequestRegistry.layer` built into a long-lived runtime is one registry for every request. That's how Layer memoization works, not module state.
  - A read under a `RegistryContext` provided below its boundary is caught, but `reset` refreshes the boundary's registry.
- **Tests:** `packages/effect-atom-boundary/test/ServerRendering.test.tsx` renders two requests at once, held at a gate until both render, then hydrates both and resets one. `ErrorBoundary.test.tsx` fails two registries with one error object. `packages/raf-effect-atom/test/ServerRendering.test.tsx` streams two requests' results through both `HydrationBoundary` paths.
