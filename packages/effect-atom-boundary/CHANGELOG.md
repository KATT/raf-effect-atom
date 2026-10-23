# Changelog

## [0.1.2](https://github.com/KATT/raf-effect-atom/compare/effect-atom-boundary%400.1.1...effect-atom-boundary%400.1.2) (2026-10-23)

### Features

- **effect-atom-boundary:** type a boundary's errors from an AtomHttpApi client ([60b0efd](https://github.com/KATT/raf-effect-atom/commit/60b0efd92740e198a45012d4423bcd04cabfef2c))

### Documentation

- correct the generated changelogs' cut-off breaking change and bogus issue links ([c21f64c](https://github.com/KATT/raf-effect-atom/commit/c21f64cad3b4638f2341968aa2e10af5a19904c1))

## [0.1.1](https://github.com/KATT/raf-effect-atom/compare/effect-atom-boundary%400.1.0...effect-atom-boundary%400.1.1) (2026-10-23)

### Bug Fixes

- **effect-atom-boundary:** keep a failed read's record in the registry it ran in ([520f60c](https://github.com/KATT/raf-effect-atom/commit/520f60c2fad9a6ca8ee34cb5f581e19d7ef04d7c))

## 0.1.0 (2026-10-23)

### ⚠ BREAKING CHANGES

- **effect-atom-boundary:** `useAtomResult`, `claim`, `ClaimedResult` and `SettledResult`
  are removed, and `ErrorBoundaryClaims` no longer has `claim`. Read
  `raf-effect-atom`'s `useAtomResult(useXBoundary().wrap(atom))`, or
  `useAtomSuspense(AtomErrorBoundary.claim(atom), { suspendOnWaiting: true })`.
- **raf-effect-atom:** the loader verbs take a source and its arguments and
  return a handle, and `useAtomResult` reads a handle through a source.

  - `prefetch(issue, id)` returns a `Handle<typeof issue>`; `ensure` and
    `fetch` return a `LoadedHandle`, which adds `loaded: true`. A source is
    an atom family, such as an AtomRpc query, or one AsyncResult atom, whose
    handle has no arguments. The same holds for `Loader.make(registry)`, the
    router contexts' `atoms` and `raf-effect-atom/next`'s verbs.
  - A handle is plain data, `{ args, key }`, so loaders return it in their
    data and server components pass it to client components as a prop. Its
    type names its source through a brand on the key, `HandleKey<S>`, so
    one family's handle doesn't fit another's prop. The brand is on the key
    because React Router's `Serialize` type drops an optional phantom field
    from loader data and keeps branded strings; an atom source's args are a
    mutable `[]` because `Serialize<readonly []>` is `readonly never[]`.
  - `Loader.result(handle)` gives loader code the settled result of an
    `ensure` or `fetch`. The result can't ride on the handle: AsyncResult and
    Schema classes don't survive turbo-stream, seroval, JSON or server
    component props. It's kept in a WeakMap keyed by the handle object, and
    a copy of the handle throws.
  - `useAtomResult(source, handle)` reads `source(...handle.args)`. Its
    handle parameter widens the source's error to `unknown`, so a boundary's
    `wrap(issue)` reads `issue`'s handles with the per-tag narrowing and the
    `Success<A, never>` typing kept. In development it throws when the atom
    it hydrates has a serialization key other than the handle's.
  - `useWaterfall(source, ...args)` returns a handle, the one way to make a
    handle during render.

  The waterfall warning names the new call shapes.

  Migrated with it, so no commit has a red tree:
  - The three example apps: loaders return the handles of the atoms they
    start, and pages pass them down (TanStack Start through
    `Route.useLoaderData()`, React Router through `loaderData.handles` next
    to the dehydrated atoms, Next.js as server component props). Components
    take a handle instead of an id. "Load more" keeps the next page's handle
    in state, made by `Loader.make(registry).prefetch(source, ...args)` in
    the click handler.
  - www: the docs route, demo embeds and the loader-verbs, waterfalls,
    hydration, boundary-chain and every-tag-caught demos; the TanStack Start, Next.js and
    React Router doc samples, the error-boundaries and every-tag-caught
    samples included; the home page's steps; and the pages that
    show the verbs and reads (loader verbs gains a Handles section and
    `Loader.result`, reading atoms explains handles as props, request
    waterfalls, coding agents, shared boundaries, error boundaries, loader
    failures).
    `www/src/use-loaded.ts` is gone: a wrapper generic over a family can't
    satisfy `useAtomResult`'s `Readable` constraint, and
    `useAtomResult(source, handle).value` reads as well. The "Fetches in a
    component" mistake on the home page is now caught by the compiler.
  - The package READMEs, the boundary's JSDoc example, and the decision in
    `.agent-docs/decisions/atom-handles.md`.

### Features

- **effect-atom-boundary:** add claims.wrap and AtomErrorBoundary.claim ([05750fe](https://github.com/KATT/raf-effect-atom/commit/05750fe38129e6707c7e72791a27635bfb3fe5d2))
- **effect-atom-boundary:** drop useAtomResult and claim ([024d029](https://github.com/KATT/raf-effect-atom/commit/024d029020f3fa15f33d4abed516df0a6256353f))
- **effect-atom-boundary:** render a caught failure's handler during server rendering ([07492a3](https://github.com/KATT/raf-effect-atom/commit/07492a3395edd0467fb6c95b33d36e740ec53bce))
- **effect-atom-boundary:** typed error boundaries for Effect Atom ([76b45c0](https://github.com/KATT/raf-effect-atom/commit/76b45c080082ea8f52236f775821cae5c5647ccd))
- **effect-atom-boundary:** wrap and claim take atom families ([ac25fb6](https://github.com/KATT/raf-effect-atom/commit/ac25fb6c2c950278c5aaa0d630cd500b1f4db2e8))
- **raf-effect-atom:** loader verbs return handles that components read ([52a4323](https://github.com/KATT/raf-effect-atom/commit/52a4323bae1507e6b5f524262b7ed1609b1ed5d6))

### Bug Fixes

- **effect-atom-boundary:** keep createErrorBoundary working under React Compiler ([8930765](https://github.com/KATT/raf-effect-atom/commit/8930765610fd89d7a02d2dad1d3fdfaef5f78d31))
- **effect-atom-boundary:** refresh every failure a shared boundary handles on reset ([d1e6de6](https://github.com/KATT/raf-effect-atom/commit/d1e6de61b2e1b7d94624acd3e9cd312852378c9d))
- **effect-atom-boundary:** render catchTags handlers as components ([76c8af7](https://github.com/KATT/raf-effect-atom/commit/76c8af7adc255ac5e1e370e2c11315b39f24f1f2))

### Code Refactoring

- **effect-atom-boundary:** rename files to kebab-case ([2c8d096](https://github.com/KATT/raf-effect-atom/commit/2c8d096d54375a610ad6bc59c40d2605dc67dae3))
- **effect-atom-boundary:** restore Effect's file names ([2fa048e](https://github.com/KATT/raf-effect-atom/commit/2fa048e897a16927222aa7432da2194f6ad8b57e))
- **examples:** read boundary claims through wrap ([ae92f67](https://github.com/KATT/raf-effect-atom/commit/ae92f67722417542ee06a7299b327a77a0597814))

### Documentation

- catch RpcClientError in an app boundary, and read fully claimed atoms as successes ([fe9b485](https://github.com/KATT/raf-effect-atom/commit/fe9b485fd19643a34f1709ebb5b66c90036eea47))
- **effect-atom-boundary:** define every boundary a docs sample uses ([820817b](https://github.com/KATT/raf-effect-atom/commit/820817b208c18e817645395dd5c977e741b475e5))
- point coding agents at the rules from the READMEs ([e8d3047](https://github.com/KATT/raf-effect-atom/commit/e8d30477e840df83c0f47764bdf505bc61181f14))

### Tests

- keep each package's Vitest module cache to itself ([be11618](https://github.com/KATT/raf-effect-atom/commit/be11618b41f9cecaba6968a356677a7dd3bfe734))

### Continuous Integration

- release each changed package after CI passes on main, and pack-check the tarballs on every push ([8ab3b90](https://github.com/KATT/raf-effect-atom/commit/8ab3b90e4ac2e7d6c25c028aace7167279bdb2b3))
