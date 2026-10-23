# Waterfalls are found at read time in development, with useWaterfall as the escape hatch (agent)

- **Why detection, unlike raf-query.** raf-query prevents fetch-on-render by API shape: `useQuery` reads only a handle a loader made. `useAtomResult` reads any atom, and Atom's registry starts an atom on its first read, so a component reading an atom nothing started silently starts the request in render. That is what a coding agent writes when it adds a component and forgets the loader.
- **The check** (`src/internal/waterfalls.ts`) runs in `useAtomResult` on the read's source (the `initialValueTarget` source of a boundary's `wrap`).
  - It does nothing when the registry already has the source's node, a preloaded value for it, or a pending stream.
  - Otherwise it snapshots the node keys, reads, and walks the new nodes' `parents`. A waterfall is a node the read created whose value is an `Initial` `AsyncResult` with no `Initial` parent. Derived atoms over a loader-started source, loading or loaded, and synchronous atoms don't count.
- **Modes** come from `<WaterfallDetection mode>`, a React context: `warn` (the default) logs with `console.warn` once per atom and registry, `throw` throws to the nearest error boundary, and `off` doesn't check.
  - It's a context, not a registry option, because the integrations make their registries internally, and one component in the root layout covers the server and browser renders in every framework.
  - `console.warn`, like React's own development warnings, so devtools show the component's stack.
  - `throw` remembers the node it threw for and throws on every later read of that node: React renders a component that threw once more, and that render finds the node.
- **Development only, through `process.env.NODE_ENV !== "production"`**, an exception to `effect-everywhere.md`. Every bundler replaces it at build time, so client builds drop the check. `Config`'s `NODE_ENV` can't be used: in the browser, `ConfigProvider.fromEnv` doesn't see `NODE_ENV`, so the check would run in production. TanStack Router and React use the same expression.
- **`useWaterfall(atom)`** starts an atom during render, like `Loader.prefetch`, for inputs only a render knows, and returns it. Greppable, as in raf-query. It's passed the source, inside any `wrap`, because the wrapper isn't serializable.
- **Event handlers start atoms too.** The examples' "Load more" handlers call `Loader.make(registry).prefetch(nextPage)` before the state change that renders the next page's reader. That isn't a render-time input, so `useWaterfall` there would mislabel it.
- **The examples use `mode="throw"`**, the strict setting for agents to copy. Their `test:browser` runs production builds, where the check is compiled out; the package's tests cover it.
- Rejected:
  - module-level configuration (global mutable state, and one call per server and browser entry);
  - registry options (the integrations own the registries);
  - `throw` as the default (too abrupt for existing apps; the docs recommend it);
  - a per-atom opt-out (a waterfall is about the read site, not the atom).
- Files: `packages/raf-effect-atom/src/{waterfalls.tsx,internal/waterfalls.ts,use-atom-result.ts}`, `test/waterfalls.test.tsx`, `www/content/request-waterfalls.md`.
