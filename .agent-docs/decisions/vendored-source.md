# Vendored Effect and TanStack Router source (human asked)

- `vendor-src` manages `.repos/` from `vendor-src.json` as `git subtree` imports, committed to the repo (`postinstall`: `vendor-src check`).
- `effect` → `.repos/effect` (the whole Effect monorepo: `packages/effect/src/reactivity` for Atom, `AtomRpc`, `Hydration`; `packages/effect/src/rpc`; `packages/atom/react`). `@tanstack/react-router` → `.repos/router` (loaders, SSR streaming, `dehydrate` / `hydrate`). Their versions are the root devDependencies, which exist for vendor-src.
- No `react-router` or `next` checkout: raf-query vendors neither. Add one with `vendor-src add` if an integration needs to read their source.
- Vendored versions are always the installed ones, and dependencies track their latest release (human), so a dependency bump is followed by `vendor-src sync`.
- Read those trees for how atoms, RPC and router SSR actually work; don't invent parallel APIs from memory.
- To bump: change the root devDependency (and the catalog for Effect), `pnpm install`, then `pnpm exec vendor-src sync`, which commits the subtree pull itself.
