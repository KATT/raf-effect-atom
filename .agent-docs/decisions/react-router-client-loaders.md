# React Router loaders double as client loaders (agent)

- **Shape:**
  - `clientAtomsMiddleware(atomsContext)` from `raf-effect-atom/react-router` is the root's `clientMiddleware`. It sets the same `RequestAtoms` the server middleware sets, over the browser registry of the mounted `RegistryProvider`, with a `dehydrate` that returns `[]`.
  - Each route writes its loader as one function and exports it twice: `export const loader = load; export const clientLoader = load`. React Router removes `loader` from the browser bundle, so a `clientLoader` that calls `loader` fails at runtime with `loader is not defined`.
  - `RegistryProvider` records its browser registry while it's mounted (`internal/registry.ts`'s `mount` and `current`), since client middleware runs outside React. The middleware throws when none is mounted.
  - The example's root loader only reads the settings cookies, which the menu keeps in its own state after the first page, so it has `shouldRevalidate = () => false`.
- **Why:** with server-only loaders, every navigation ran in a fresh request registry, so `ensure` waited like `fetch` every time. Link prefetch fetched `<path>.data` and the click fetched it again, because React Router doesn't reuse the prefetched response. With client loaders, `ensure` reads the browser's registry, as on TanStack Start, and React Router doesn't prefetch `.data` for routes with a `clientLoader`: links preload route modules only.
- **Lost:** hovering a link no longer starts the next page's atoms. Before, the hover's `.data` was fetched again on click, so it saved nothing for data.
- **Rejected:**
  - Cache headers on `.data` so the click reuses the prefetch: `fetch` must get fresh results, and `ensure` would still wait on every navigation.
  - A `clientLoader` that calls `serverLoader()` only when the browser's registry lacks a result: it can't know which atoms the loader needs without running it.
