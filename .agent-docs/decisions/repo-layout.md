# Repo layout (agent)

- Vite+/pnpm workspace (`pnpm-workspace.yaml`): `packages/*` (the two published libraries), `examples/*` (TanStack Start and Next.js apps), `examples/.shared/*` (the RPC contract, the backend, db, UI kit; listed separately because `examples/*` doesn't reach dot directories), `www` (docs site), `www/samples/*` (docs sample apps), `tooling/*` (private tools).
- `tooling/`: `oxlint-plugins` (raf-query's lint plugins), `vercel-ignore` (Vercel's ignore step), `conventional-commits` (the commit-subject check).
- Root scripts fan out with `pnpm -r --filter` (`build`, `test`, `typecheck`); `lint`, `format` and `knip` run once at the root. A filter that matches no package yet is harmless.
- One Effect in the workspace: `pnpm-workspace.yaml`'s `catalog` pins `effect`, `@effect/platform-node` and `@effect/vitest` to one version, and `overrides` force vendor-src's own Effect onto it.
- Shared root files: `LICENSE`, `CHANGELOG.md` (generated on release), `www/public/favicon.svg` (the logo, see [logo.md](./logo.md)).
