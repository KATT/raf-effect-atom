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

Only atoms in the registry when the loaders finish are sent to the browser. An atom first read during render runs again there, so start every atom a page reads from its loader.

With `defaultPreload: "intent"`, hovering a link runs its loader, so the atoms start before the click.

## Loaders as Effects

`RouteLoader.all(args, { ... })` runs a struct of [Effect verbs](./loader-verbs.md#in-effect-code) on the registry of `context.atoms`, so they need nothing provided, and returns the struct of their handles as the loader's data:

```sample
tanstack-start/src/docs/tanstack-start.tsx#effect-loader
```

- The loader stays an arrow that takes TanStack's arguments and passes them on, so the router types `args.params` and the loader's data.
- The verbs run concurrently, as [`Effect.all`](https://effect.website/docs/v4/concurrency/basic-concurrency/#unbounded-concurrency) with unbounded concurrency.
- `RouteLoader.run(args, effect)` runs any Effect, such as an `Effect.gen` whose steps depend on each other, and returns its success.
- The Effect may fail only with `RouteLoader.notFound()` or `RouteLoader.redirect(options)`, which take the options of TanStack's [`notFound`](https://tanstack.com/router/latest/docs/framework/react/api/router/notFoundFunction) and [`redirect`](https://tanstack.com/router/latest/docs/framework/react/api/router/redirectFunction). The loader throws the router's own value for them. Any other failure is a type error.
- `Loader.catchTags` turns the typed failures you name into one of those. A handle whose result is any other failure is returned as is, for a boundary to render.
- Navigating away interrupts the Effect. The atoms it started keep loading.
