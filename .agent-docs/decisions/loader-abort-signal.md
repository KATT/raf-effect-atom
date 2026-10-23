# The integrations give the verbs the request's abort signal; TanStack Router can't (agent)

- **What.** `Loader.make(registry, { signal })`. `ensure` and `fetch` run with it, and an aborted signal rejects them with `signal.reason`, as `fetch` does, instead of Effect's "All fibers interrupted". The atoms they started keep loading under their lease.
- **Why.**
  - Without the signal, a wait whose request goes away never resumes. The registry is disposed, and the `settled` callback is dropped without resuming, so the loader's Promise hangs.
  - React Router races loaders against `request.signal` and moves on, so only the hanging fiber is lost.
- **Where it's automatic.**
  - React Router on the server: `atomsMiddleware` passes `args.request.signal`. The Node and Express adapters abort it only on `close` without `finish`, so streamed promises in finished responses are never interrupted.
  - React Router in the browser: `clientAtomsMiddleware` makes the verbs per navigation with that navigation's `request.signal`. The router aborts `pendingNavigationController` only when another navigation interrupts it, and drops it without aborting once the navigation completes.
  - Next.js: the verbs pass React's `cacheSignal()`, the same signal that disposes the registry. It aborts when the render ends, after every awaited verb has settled, or when React aborts the render.
- **Not TanStack Router.** `context.atoms` is one object per router, and each navigation's signal is only in the loader's arguments. No hook fits:
  - Rebinding `atoms` in the root route's `beforeLoad`: Start serializes `__beforeLoadContext` to the browser, and an object of functions can't cross.
  - A route's `context` function: cached per match across navigations (`match._ctx ||=`).
  - Wrapping every route's `loader`: lazy routes, and code splitting moves loaders.
  - The client aborts a preload's controller once the preload ends, and the previous navigation's when the next one starts. A verb bound to it would reject an unawaited `ensure` that a preloaded loader returned.
  - TanStack Router loaders pass the signal explicitly, by running the Effect verbs with `context.atoms.run(effect, { signal: abortController.signal })` (`Loader.Loader.run`, also from the spike), or with the spike's `RouteLoader.run`, which isn't on main ([PR #1](https://github.com/KATT/raf-effect-atom/pull/1)).
- Files: `packages/raf-effect-atom/src/{Loader.ts,ReactRouter.ts,internal/rsc.ts}`, the abort tests in `test/{Loader,ReactRouter,Rsc.rsc}.test.ts(x)`, and `www/content/loader-verbs.md#aborted-requests`.
