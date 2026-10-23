---
title: TanStack Start
description: raf-effect-atom/tanstack-router makes a registry per request, puts the loader verbs on the router context, and streams the registry to the browser.
section: raf-effect-atom
order: 5
---

`raf-effect-atom/tanstack-router` connects the loader verbs to [TanStack Router](https://tanstack.com/router/latest) and [TanStack Start](https://tanstack.com/start/latest). This site uses it too: each page is an atom its route's loader starts, prerendered to static HTML.

## The router

`getRouter` runs once per request on the server and once in the browser:

```sample
tanstack-start/src/router.tsx#router
```

- `makeRegistry()` returns a request registry on the server and a browser registry in the browser. The browser's registry keeps an atom no component reads for 400 ms, as `@effect/atom-react`'s default registry does; `makeRegistry({ defaultIdleTTL: 60_000 })` keeps it for a minute, so navigating back shows it at once. An atom's own [`Atom.setIdleTTL`](https://github.com/Effect-TS/effect/blob/effect%404.0.6/packages/effect/src/reactivity/Atom.ts) or `Atom.keepAlive` wins.
- `makeRegistry({ seed })` runs `seed` on each request's registry before the loaders start atoms in it, to set what they need from the request, such as an atom holding its cookie for an RPC protocol that forwards it. It can be async; `setupRouterAtoms` waits for it, and for the atoms loaders started meanwhile, before it dehydrates. The browser's registry isn't seeded.
- `Loader.make(registry)` puts `prefetch`, `ensure` and `fetch` on the [router context](https://tanstack.com/router/latest/docs/framework/react/guide/router-context).
- `setupRouterAtoms` wraps the app in the registry's `RegistryContext`, adds `Hydration.dehydrate(registry)` to the router's dehydrated state once the loaders have run, hydrates it in the browser before the app renders, and disposes the server's registry when the response finishes.

The root route types the context:

```sample
tanstack-start/src/routes/__root.tsx#root
```

## Loaders

```sample
tanstack-start/src/routes/issues.$id.tsx#route
```

[`params.parse`](https://tanstack.com/router/latest/docs/framework/react/api/router/RouteOptionsType#params-parse-method) decodes `$id` with a [Schema](https://github.com/Effect-TS/effect/blob/effect%404.0.6/packages/effect/src/Schema.ts) built on the contract's `IssueId`, the one the RPCs decode with, and [`params.stringify`](https://tanstack.com/router/latest/docs/framework/react/api/router/RouteOptionsType#params-stringify-method) encodes it back. The loader, the page and links all take an `IssueId`, and an `$id` that isn't one goes to the route's error component.

Only atoms in the registry when the loaders finish are sent to the browser. An atom first read during render runs again there, so start every atom a page reads from its loader.

With `defaultPreload: "intent"`, hovering a link runs its loader, so the atoms start before the click.
