# Example apps (human decided)

- **Three apps, the same issue tracker**, built in this order: `examples/tanstack-start`, then `examples/nextjs` once the API holds up there, then `examples/react-router` (human: React Router is back in scope, as in raf-query, after the other two).
- `examples/react-router` is React Router Framework Mode with SSR (`react-router.config.ts`: `ssr: true`), code under `app/` rather than `src/`. The lint overrides already cover `examples/*/app`. Its knip workspace needs the `react-router typegen` note raf-query has (`./+types/*` lives in `.react-router/types`).
- Every backend is Effect RPC over one shared contract; the apps import only the contract and serve the backend's handlers from a route (TanStack Start: a server route; Next.js: an App Router route handler; React Router: a resource route), in-process during server rendering and over `fetch` in the browser.
- **Forms are [TanStack Form](https://tanstack.com/form)** (human): the inline title/body edits and the status change.
- UI is the vanilla shadcn package `examples/.shared/ui`, shared with `www` ([shared-ui.md](./shared-ui.md)); shared markup with no data code in `examples/.shared/kit` (as in raf-query, so each app's atoms and loaders read on their own).
- A `verify-examples` skill and its feature map drive both apps with headless Chrome.
