# npm release path (human: publishing stays with the maintainer)

- release-it + GitHub Actions, run from the repo root (`.release-it.json`, `.github/workflows/release.yaml`). Setup steps live in `.github/DEVELOPMENT.md`.
- **The Release workflow only runs by hand** (`workflow_dispatch`). Human: set up the release, but leave publishing to them; agents never run release-it or `npm publish`. raf-query releases on every push to `main`; adding a `push` trigger switches to that, since the gate and the stale-main check already handle it.
- `npm: false` in release-it: the **latest git tag is the version source**; `after:bump` writes the version into every `packages/*/package.json`. Before the first tag, the gate counts every commit under `packages/*`.
- **Publish before git**: `before:git:release` builds, checks `main` hasn't moved ([release-skips-stale-main.md](./release-skips-stale-main.md)), then publishes `effect-atom-boundary` and `raf-effect-atom` (each package's `publish:npm`), so a failed publish pushes no commit or tag.
- Publishes via npm OIDC trusted publishing (`id-token: write`, empty `NODE_AUTH_TOKEN`). npm only allows a trusted publisher on a package that exists, so each package needs one manual first publish (`--provenance=false`) before `npm trust github`. `npm publish` from an agent shell fails with `EOTP` anyway.
- Before the first release, check both names (and punctuation variants such as `raf-effectatom`, `effect-atom-boundaries`, `@effect-atom/boundary`) are still free on npm. On 2026-10-23 `raf-effect-atom` and `effect-atom-boundary` were.
