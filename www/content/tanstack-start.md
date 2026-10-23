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
- `makeRegistry({ initialValues })` starts both registries with values, as [`AtomRegistry.make`](https://github.com/Effect-TS/effect/blob/effect%404.0.6/packages/effect/src/reactivity/AtomRegistry.ts)'s `initialValues` does: pairs from [`Atom.initialValue`](https://github.com/Effect-TS/effect/blob/effect%404.0.6/packages/effect/src/reactivity/Atom.ts), such as the session the server verified. Unlike `registry.set` in a seed, they reach readable atoms, such as one that provides the request's `fetch` to an `AtomHttpApi` client's layer. The server's request registry keeps each of these atoms mounted until it's disposed. The browser's registry drops an atom no component reads, value included, so make one whose value must outlive its readers `Atom.keepAlive`.
- `makeRegistry({ seed })` runs `seed` on each request's registry before the loaders start atoms in it, to set what they need from the request, such as an atom holding its cookie for an RPC protocol that forwards it. It can be async; `setupRouterAtoms` waits for it, and for the atoms loaders started meanwhile, before it dehydrates. The browser's registry isn't seeded.
- `Loader.make(registry)` puts `prefetch`, `ensure` and `fetch` on the [router context](https://tanstack.com/router/latest/docs/framework/react/guide/router-context).
- `setupRouterAtoms` wraps the app in the registry's `RegistryContext`, adds `Hydration.dehydrate(registry)` to the router's dehydrated state once the loaders have run, hydrates it in the browser before the app renders, and disposes the server's registry when the response finishes. It keeps the router's own [`Wrap`](https://tanstack.com/router/latest/docs/framework/react/api/router/RouterOptionsType#wrap-property), [`dehydrate` and `hydrate`](https://tanstack.com/router/latest/docs/framework/react/api/router/RouterOptionsType#dehydrate-method): its `Wrap` renders inside the registry's provider, and its dehydrated state gets one more key, `raf-effect-atom`.

An app that streams the registry its own way can leave `setupRouterAtoms` out and use the pieces it's made of: `makeRegistry` or [`RequestRegistry.make`](./reading-atoms.md#on-the-server) for the registry, `Loader.make(registry)` on the router context, `RegistryContext` around the app, and on the server, after the loaders, `await RequestRegistry.settled(registry)` then `Hydration.dehydrate(registry)` into its own dehydrated state, which the browser's `hydrate` passes to `Hydration.hydrate(registry, state)`. The verbs, `useAtomResult` and the boundaries only need the registry to be a request registry on the server.

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
