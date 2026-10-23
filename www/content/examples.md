---
title: Examples
description: The same issue tracker on TanStack Start, on the Next.js App Router and on React Router Framework Mode, live on Vercel and ready to open in CodeSandbox.
section: Getting started
order: 5
---

The repository has one app built three times: a small issue tracker on [TanStack Start](https://tanstack.com/start), on the [Next.js App Router](https://nextjs.org/docs/app) and on [React Router Framework Mode](https://reactrouter.com/start/modes#framework), so the integrations can be compared side by side. All three use both packages over the same [Effect RPC](https://github.com/Effect-TS/effect/tree/effect%404.0.6/packages/effect/src/rpc) contract. Each runs live on [Vercel](https://vercel.com), and opens in [CodeSandbox](https://codesandbox.io), which installs it on a cloud VM and starts its dev server.

| Framework                   | Source                                                                                                 | Live                                                                                       | Try it                                                                                                                                                                                     |
| --------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| TanStack Start              | [`examples/tanstack-start`](https://github.com/KATT/raf-effect-atom/tree/main/examples/tanstack-start) | [tanstack-start.raf-effect-atom.katt.dev](https://tanstack-start.raf-effect-atom.katt.dev) | [Open in CodeSandbox](https://codesandbox.io/p/devbox/github/KATT/raf-effect-atom/tree/codesandbox/examples/tanstack-start?file=/apps/tanstack-start/src/routes/prefetch/issues/index.tsx) |
| Next.js App Router          | [`examples/nextjs`](https://github.com/KATT/raf-effect-atom/tree/main/examples/nextjs)                 | [nextjs.raf-effect-atom.katt.dev](https://nextjs.raf-effect-atom.katt.dev)                 | [Open in CodeSandbox](https://codesandbox.io/p/devbox/github/KATT/raf-effect-atom/tree/codesandbox/examples/nextjs?file=/apps/nextjs/src/app/prefetch/issues/page.tsx)                     |
| React Router Framework Mode | [`examples/react-router`](https://github.com/KATT/raf-effect-atom/tree/main/examples/react-router)     | [react-router.raf-effect-atom.katt.dev](https://react-router.raf-effect-atom.katt.dev)     | [Open in CodeSandbox](https://codesandbox.io/p/devbox/github/KATT/raf-effect-atom/tree/codesandbox/examples/react-router?file=/apps/react-router/app/routes/prefetch/issues.tsx)           |

CodeSandbox opens the issue list's route file, and the preview shows the running app once the install finishes.

## How each one starts atoms

- **TanStack Start**: route [`loader`](https://tanstack.com/router/latest/docs/framework/react/guide/data-loading)s start atoms with the `Loader` on the router context, and `setupRouterAtoms` streams what the server's loaders started into the browser's registry (see [TanStack Start](./tanstack-start.md)). After the first page, loaders run in the browser, so `ensure` shows what the registry already holds at once.
- **Next.js**: server components start atoms with `prefetch`, `ensure` and `fetch` from `raf-effect-atom/next`, and `<HydrateAtoms state={await dehydrate()}>` hands them to the client components under it. Every navigation renders on the server in a new request registry, so `ensure` waits as long as `fetch`.
- **React Router**: server [`loader`](https://reactrouter.com/start/framework/data-loading)s start atoms in the request's registry and return `atoms.dehydrate()`, which the route renders under `<HydrationBoundary>` (see [Hydration](./hydration.md)). Every navigation runs the loaders on the server, so here too `ensure` waits as long as `fetch`.

The backend reads the session and latency from cookies, so on the server each app seeds the request registry with the page request's cookie, which its RPC protocol sends: `makeRegistry({ seed })` on TanStack Start, `atomsMiddleware(atomsContext, { seed })` on React Router, and the verbs from `makeRequestAtoms({ seed })` on Next.js, whose seed awaits `headers()`.

## What they cover

| Screen or action                                             | Shows                                                                                                                                                                                              |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Loader verb                                                  | The URL's first segment picks how loaders start atoms: [`prefetch`, `ensure` or `fetch`](./loader-verbs.md) (`/ensure/issues/3`)                                                                   |
| Issue list with status filter and sort                       | Search params into a loader, the first page in the server's HTML, then infinite scroll with `Loader.make(registry).prefetch` for the next page                                                     |
| Issue detail                                                 | Under `prefetch` the page opens onto skeletons that stream in; `ensure` and `fetch` wait for the issue                                                                                             |
| Assignee card                                                | The loader starts the assignee by issue id next to the issue, so neither waits on the other (see [Request waterfalls](./request-waterfalls.md))                                                    |
| Comments under an issue                                      | A paged atom that streams in under every verb, and posting a comment with a pending row                                                                                                            |
| Inline-edit title and description; change status             | `AtomRpc` mutations that refresh the queries they touch; the server refuses an empty value, and its message shows under the field                                                                  |
| `/prefetch/issues/999`, or **Session** set to **Signed out** | [Error boundaries](./error-boundaries.md) by tag: `IssueNotFound` in the issue's boundary, `Unauthorized` in the auth boundary, and `RpcClientError` in the app's when the server can't be reached |
| Progress bar along the top                                   | The router's pending state while `ensure` and `fetch` wait                                                                                                                                         |

Data comes from an in-memory database with 42 seeded issues and artificial latency (400 ms ± 50% per call), behind the RPC backend the three apps share. The top bar's **Loader** select switches the loader verb and keeps the page you are on. It also sets the latency, how links prefetch, and whether the session is signed in; **Reset settings** puts those back. Data the server loads for the first render streams in with the HTML; later loads show up in the browser's network tab as `POST /rpc`. On the deployed apps, the next request can reach a different server instance with its own copy of the data, so an edit may not stick.

## Run them locally

```bash
git clone https://github.com/KATT/raf-effect-atom
cd raf-effect-atom
pnpm install
pnpm --filter @examples/tanstack-start dev  # http://localhost:3005
pnpm --filter @examples/react-router dev    # http://localhost:3006
pnpm --filter @examples/nextjs dev          # http://localhost:3007
```

The [`codesandbox` branch](https://github.com/KATT/raf-effect-atom/tree/codesandbox) holds a standalone copy of each app, with the libraries and the shared example packages next to it in one pnpm workspace. Clone that branch to run one app outside the monorepo: `pnpm install && pnpm dev` in `examples/<app>`.

## Demos in these docs

The guides also embed live demos that run entirely in your browser, each with its own registry and a fake server with adjustable latency. Good places to start:

- [Error boundaries](./error-boundaries.md): failures caught by tag, and resetting a boundary
- [Loader verbs](./loader-verbs.md): prefetch, ensure and fetch
- [Request waterfalls](./request-waterfalls.md): chained versus parallel loading
