# Example apps (human decided)

- **Two apps, the same issue tracker**: `examples/tanstack-start` first, then `examples/nextjs` once the API holds up there. React Router is out of scope (human), for the integrations and the examples.
- Every backend is Effect RPC over one shared contract; the apps import only the contract and serve the backend's handlers from a route (TanStack Start: a server route; Next.js: an App Router route handler), in-process during server rendering and over `fetch` in the browser.
- **Forms are [TanStack Form](https://tanstack.com/form)** (human): the inline title/body edits and the status change.
- UI is shadcn on Base UI in `examples/.shared/ui`, kept vanilla; shared markup with no data code in `examples/.shared/kit` (as in raf-query, so each app's atoms and loaders read on their own).
- A `verify-examples` skill and its feature map drive both apps with headless Chrome.
