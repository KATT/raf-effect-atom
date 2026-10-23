# Browser-only reads start with `prefetchInBrowser` (user may revisit)

- **Problem:** some reads need what only the browser has: a token in the URL's fragment, a credential in `sessionStorage`, a browser API. Loaders still have to start every read, nothing may fetch on render, and the rest of the page keeps its SSR on all three frameworks.
- **Chosen: a per-call verb, `prefetchInBrowser(source, ...args)`,** on `Loader`, `Loader.make(registry)` and `raf-effect-atom/next`.
  - In the browser it's `prefetch`.
  - On a request registry it starts nothing and returns a handle marked `inBrowser: true`, so the atom needs no serialization key.
  - On the server, `useAtomResult` throws for a marked handle, so React renders the nearest Suspense fallback and the browser renders the boundary. In the browser, the read starts the atom, and the waterfall check skips it.
- **Rejected:**
  - **A route-level `ssr: false`,** the first answer. It's TanStack-only, and the server loses the whole route's SSR for one read.
  - **An `enabled` boolean on the atom,** like raf-query's `enabled: typeof window !== "undefined"`. In raf-query the query owns its start, so it needs an "off" state. Here loaders own the start, and a loader that doesn't start an atom already expresses "off". A per-atom flag also decides for every call site, where `prefetchInBrowser` decides per loader.
  - **A `skipToken`-style argument,** like TanStack Query's. A loader returning `handle | undefined` already expresses "not yet", and raf-query leaves it out for the same reason: the route owns the input.
- **Revisit** if the user prefers a per-atom flag, for example if KATT/executor marks the same atom browser-only at every call site.
