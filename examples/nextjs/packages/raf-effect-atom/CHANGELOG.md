# Changelog

## [0.2.3](https://github.com/KATT/raf-effect-atom/compare/raf-effect-atom%400.2.2...raf-effect-atom%400.2.3) (2026-10-23)

### Features

- **raf-effect-atom:** run Effect code on a loader's registry with Loader.Loader.run ([d26307d](https://github.com/KATT/raf-effect-atom/commit/d26307dc6279106ebd9d26078c88e4ad10a8cbc9))

## [0.2.2](https://github.com/KATT/raf-effect-atom/compare/raf-effect-atom%400.2.1...raf-effect-atom%400.2.2) (2026-10-23)

### Features

- **raf-effect-atom:** stop a loader's wait when its request is aborted ([b1f2f16](https://github.com/KATT/raf-effect-atom/commit/b1f2f16fcce9cd5dd1ba18fa653b40c805eebd93))

### Bug Fixes

- **raf-effect-atom:** refuse to hydrate a shared registry during server rendering ([2f793a6](https://github.com/KATT/raf-effect-atom/commit/2f793a63627482bdf2f0e2891829f5191077cfc7))

### Documentation

- **raf-effect-atom:** date clientAtomsMiddleware to 0.2.1, the release it shipped in ([c2a4288](https://github.com/KATT/raf-effect-atom/commit/c2a4288f4c5b63575e019712edc9fdc49a052bd2))
- record that the packages' module state is keyed by what one request owns ([22b23f9](https://github.com/KATT/raf-effect-atom/commit/22b23f947544f8c4459ef172e8b21499403059c4))

## [0.2.1](https://github.com/KATT/raf-effect-atom/compare/raf-effect-atom%400.2.0...raf-effect-atom%400.2.1) (2026-10-23)

### Features

- **raf-effect-atom:** run React Router loaders in the browser after the first page ([bee00a9](https://github.com/KATT/raf-effect-atom/commit/bee00a981fd24fcdc9d746053dcd73dbc7ebc853))

## [0.2.0](https://github.com/KATT/raf-effect-atom/compare/raf-effect-atom%400.1.0...raf-effect-atom%400.2.0) (2026-10-23)

### ⚠ BREAKING CHANGES

- **raf-effect-atom:** `dehydrate()` from `raf-effect-atom/next` returns a promise: write `<HydrateAtoms state={await dehydrate()}>`.

### Features

- **raf-effect-atom:** seed each request registry, async seeds included ([62b6180](https://github.com/KATT/raf-effect-atom/commit/62b618098df87e711ddb4c1d633e191ba3353438))

## 0.1.0 (2026-10-23)

### ⚠ BREAKING CHANGES

- **raf-effect-atom:** `useAtomResult(atom, claims)` is gone. Read
  `useAtomResult(boundary.wrap(atom))` instead. `effect-atom-boundary` is no
  longer a peer dependency.

  effect-atom-boundary stays a devDependency, so the hook's tests still read
  through a real boundary's wrap (claimed tag thrown to the boundary, others
  returned). The type test now checks that a derived atom with an
  initialValueTarget is read with its own type.

  The request waterfalls docs sample, written against the claims overload,
  reads through `useIssueBoundary().wrap(atom)` too.

- **raf-effect-atom:** follow initialValueTarget in useAtomResult and throw defects
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

- **raf-effect-atom:** add the next subpath ([92cacd8](https://github.com/KATT/raf-effect-atom/commit/92cacd86cb6d6e1784d9a07f71bd9fc3ec5ca0da))
- **raf-effect-atom:** add the react-router subpath ([09b65dc](https://github.com/KATT/raf-effect-atom/commit/09b65dcbc6cfde2ae1ba2bb89e580746e9512f8b))
- **raf-effect-atom:** add the tanstack-router subpath ([0189c83](https://github.com/KATT/raf-effect-atom/commit/0189c834cd46fc05ed866859e7527b3bd2ac47df))
- **raf-effect-atom:** drop the claims overload and the effect-atom-boundary peer ([48fe91e](https://github.com/KATT/raf-effect-atom/commit/48fe91eabf71a0eb36b49c907fabae7afa5abd90))
- **raf-effect-atom:** follow initialValueTarget in useAtomResult and throw defects ([7f577ea](https://github.com/KATT/raf-effect-atom/commit/7f577eabbdd567313b542db61d532bb36a2183ca))
- **raf-effect-atom:** loader verbs return handles that components read ([52a4323](https://github.com/KATT/raf-effect-atom/commit/52a4323bae1507e6b5f524262b7ed1609b1ed5d6))
- **raf-effect-atom:** loader verbs, streaming hydration and the read hook ([6870b1a](https://github.com/KATT/raf-effect-atom/commit/6870b1a9c7742d2fa15ce1391c8fdac66307d89e))
- **raf-effect-atom:** make the browser registry's idle TTL configurable ([1c55d0e](https://github.com/KATT/raf-effect-atom/commit/1c55d0e74f54bed7cef895434357355229cff512))
- **raf-effect-atom:** read the loader's registry under HydrationBoundary during server rendering ([6751792](https://github.com/KATT/raf-effect-atom/commit/675179254563b85c61f9a96e646fa9c72f47cc83))
- **raf-effect-atom:** report request waterfalls in development, with useWaterfall as the escape hatch ([4b6fe2a](https://github.com/KATT/raf-effect-atom/commit/4b6fe2aebb939ea0a7095a5121558aa0cbc5bac5))
- **raf-effect-atom:** type useAtomResult as a success when no typed failure is left ([aeb8dc6](https://github.com/KATT/raf-effect-atom/commit/aeb8dc63e0ad874a23c3a992afed540c27c9bb7d))

### Bug Fixes

- **raf-effect-atom:** call use() on a streamed result's promise on every render that reads it ([36d2aaa](https://github.com/KATT/raf-effect-atom/commit/36d2aaa8bacf18a60507e4997fd61476d7a908c0))
- **raf-effect-atom:** point waterfall reports at the URL before the escape hatches ([0d127e3](https://github.com/KATT/raf-effect-atom/commit/0d127e38a10cb3a44340c5540c75b53491faceee))
- **raf-effect-atom:** refresh the atom the registry runs for a key in Loader.fetch ([0b35c97](https://github.com/KATT/raf-effect-atom/commit/0b35c97b4de60de254c7fc921b89aed7be753ec8))
- **raf-effect-atom:** wait for results streamed in a server component payload ([00cb981](https://github.com/KATT/raf-effect-atom/commit/00cb98125aad2cda70525fbfdedcd2b5a8f7fc79))

### Code Refactoring

- **examples:** read boundary claims through wrap ([ae92f67](https://github.com/KATT/raf-effect-atom/commit/ae92f67722417542ee06a7299b327a77a0597814))
- **raf-effect-atom:** rename files to kebab-case ([285bf4b](https://github.com/KATT/raf-effect-atom/commit/285bf4b4e5e3184ac162129f51c04d9c96921650))
- **raf-effect-atom:** restore Effect's file names ([92dc1d8](https://github.com/KATT/raf-effect-atom/commit/92dc1d8e52212c28042153cbd7b1146870839831))

### Documentation

- catch RpcClientError in an app boundary, and read fully claimed atoms as successes ([fe9b485](https://github.com/KATT/raf-effect-atom/commit/fe9b485fd19643a34f1709ebb5b66c90036eea47))
- point coding agents at the rules from the READMEs ([e8d3047](https://github.com/KATT/raf-effect-atom/commit/e8d30477e840df83c0f47764bdf505bc61181f14))
- **raf-effect-atom:** add the package README ([69c589e](https://github.com/KATT/raf-effect-atom/commit/69c589e020527ca087d7a54fb99544460ebc7774))

### Tests

- keep each package's Vitest module cache to itself ([be11618](https://github.com/KATT/raf-effect-atom/commit/be11618b41f9cecaba6968a356677a7dd3bfe734))

### Continuous Integration

- release each changed package after CI passes on main, and pack-check the tarballs on every push ([8ab3b90](https://github.com/KATT/raf-effect-atom/commit/8ab3b90e4ac2e7d6c25c028aace7167279bdb2b3))
