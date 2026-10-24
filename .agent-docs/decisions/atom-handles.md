# Components read handles, not atoms built from ids

- **Shape:**
  - The loader verbs take a source and its arguments: `prefetch(issue, id)`, `ensure(issue, id)`, `fetch(issue, id)`. A source is an atom family or one AsyncResult atom.
  - `prefetch` returns a `Handle<typeof issue>`. `ensure` and `fetch` return a `LoadedHandle`, which adds `loaded: true`, so a component can require a handle that renders without suspending.
  - A handle is plain data, `{ args, key }`: it crosses React Router's turbo-stream, TanStack's seroval, JSON and server component props.
  - Its type names its source through a brand on the key, `HandleKey<S>`, so a handle of one family doesn't fit another family's prop. The brand is on the key, not on a phantom field, because React Router's `Serialize` type drops optional phantom fields from loader data and keeps branded strings. An atom source's args are a mutable `[]`, since `Serialize<readonly []>` is `readonly never[]`.
  - `useAtomResult(source, handle)` reads `source(...handle.args)`. In development it throws when the atom's serialization key isn't the handle's.
  - `useWaterfall(source, ...args)` is the only other way to make a handle, inside a render.
- **Why:**
  - A component that takes an id and builds its atom can fetch as it renders, which raf-query's handles ruled out. A handle proves a loader, a server component or `useWaterfall` started the atom.
- **The result doesn't travel on the handle:**
  - AsyncResult and Schema classes don't survive the wires the handles cross.
  - Loader code reads the settled result with `Loader.result(handle)`, from a WeakMap keyed by the handle object, which throws for a copy.
- **Boundaries narrow the result, not the handle:** `useIssueBoundary(useAtomResult(issue, props.issue))` (see [boundary-hook-takes-result.md](./boundary-hook-takes-result.md)).
  - The reader's handle parameter widens the source's error to `unknown`, so a derived family whose atoms point at the loader's takes the loader's handle.
- **Rejected:**
  - A boundary over the handle: the handle would carry an atom or a function, which aren't serializable.
  - Handles that carry their atom: same reason.
  - A handle type over the atom instead of the family: two ids of one family are one type either way, and the family is what the reader rebuilds from.
