# Origin

`raf-effect-atom` = **r**ender-**a**s-you-**f**etch for **Effect Atom**: [raf-query](https://github.com/KATT/raf-query)'s idea without raf-query's engine. [Effect Atom](https://github.com/Effect-TS/effect/tree/main/packages/atom/react)'s registry is the cache, so the libraries here add only what Atom lacks (human: "just thin layers on top of effect atom + effect rpc"):

- `effect-atom-boundary`: typed error boundaries, typed by the atom's error type.
- `raf-effect-atom`: starting atoms from route loaders before render, with a verb per call, and streaming their results into the client registry.

Every backend is [Effect RPC](https://github.com/Effect-TS/effect/tree/main/packages/effect/src/rpc): the example apps, the docs samples and the docs site's live demos.

Tooling baseline, carried over from raf-query: TypeScript scripts written with Effect and run with plain `node`, Vite+ (`vp`), pnpm workspace, Node ≥24, TypeScript 7, oxlint/oxfmt with raf-query's custom rules, husky + lint-staged, knip, conventional commits with release-it, and vendor-src. Stick to these rather than adding parallel tools unless the human says otherwise.
