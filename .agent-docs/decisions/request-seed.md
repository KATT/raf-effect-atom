# A request registry's seed sets what its atoms need from the request (human asked)

- **Shape:**
  - `RequestRegistry.make({ seed })`: `seed(registry)` runs once on the new registry and returns `void | Promise<void>`.
  - Each integration takes the same seed: TanStack's `makeRegistry({ seed })` (server only), React Router's `atomsMiddleware(context, { seed: (registry, request) => … })`, and Next.js's `makeRequestAtoms({ seed })`, which returns `{ prefetch, ensure, fetch, dehydrate, getRegistry }` over its own `React.cache` registry. The module-level Next.js exports are an unseeded instance.
- **Async seeds:**
  - Next.js reads the request only through promises (`headers()`), so a seed can be async.
  - While it runs, `ensure` and `fetch` (and the Effect verbs) wait for it. The sync `Loader.make(...).prefetch` returns its handle at once and starts the atom after the seed. `RequestRegistry.settled(registry)` waits for the seed and those deferred starts; every integration calls it before `Hydration.dehydrate`, so Next.js's `dehydrate()` returns a promise.
  - React Router's middleware awaits the seed before `next()`, so its loaders never see a pending one.
  - A seed that rejects stays rejected: every verb after it rejects with its error rather than running unseeded.
  - Seeds live in `src/internal/seeds.ts`, a WeakMap from registry to its seeding.
- **Why:** the example apps forward the page request's cookie to in-process RPC calls through a keepAlive `requestCookie` atom. Each app set it by hand: a second React Router middleware, `registry.set` in TanStack's `getRouter`, and a `forwardCookie()` call in every Next.js page, which a new page could forget.
- **Rejected:**
  - Sync-only seeds: Next.js would still need a per-page call.
  - Reading request data in the RPC protocol when it sends: Effect runs every request's fibers from one scheduler, so a request's async context isn't reliable there.
  - A seed option on Next's module-level verbs: they're module constants, so the options need a factory.
