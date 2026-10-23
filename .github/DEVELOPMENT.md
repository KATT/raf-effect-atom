# Development

This is a Vite+ / pnpm monorepo. The publishable packages live in `packages/`:

| Directory                       | npm package            |
| ------------------------------- | ---------------------- |
| `packages/effect-atom-boundary` | `effect-atom-boundary` |
| `packages/raf-effect-atom`      | `raf-effect-atom`      |

Each package has its own `README.md`, shown on npm. The root `LICENSE` and `CHANGELOG.md` are shared: each package's `prepack` copies them in, so the tarball includes them without a second copy in git.

Tools live in `tooling/` and are written in TypeScript with Effect, run with plain `node`:

| Directory                      | What                                                           |
| ------------------------------ | -------------------------------------------------------------- |
| `tooling/oxlint-plugins`       | The custom lint rules `.oxlintrc.json` loads                   |
| `tooling/conventional-commits` | Checks commit subjects (`commit-msg` hook, `Commits` workflow) |
| `tooling/vercel-ignore`        | Vercel's Ignored Build Step                                    |

```shell
git clone https://github.com/KATT/raf-effect-atom
cd raf-effect-atom
pnpm install
```

Node is pinned in `.nvmrc`; pnpm comes from `packageManager` through corepack (`corepack enable` once per Node install). CI installs that version with `pnpm/action-setup`. `pnpm install` runs `vendor-src check`, which fails when `.repos/` doesn't match the installed versions of the vendored packages.

## Before you push

Commits go straight to `main`, so run every check CI runs first:

```shell
pnpm test
pnpm typecheck
pnpm lint
pnpm format:check
pnpm knip
```

Also run the docs site's build when `www`, its samples or the packages changed.

## Commits

Every commit subject is a [conventional commit](https://www.conventionalcommits.org/en/v1.0.0/): `type(scope)!: description`, with a type from `.release-it.json` (`feat`, `fix`, `perf`, `build`, `chore`, `ci`, `docs`, `refactor`, `style`, `test`). Breaking changes mark the type with `!`. The `commit-msg` hook rejects other subjects, and the `Commits` workflow checks every commit a push brings to `main`. release-it reads these subjects for the changelog and the version bump.

## Formatting

[Vite+ fmt](https://viteplus.dev/) (Oxfmt) formats code. A [husky](https://typicode.github.io/husky) pre-commit hook runs [lint-staged](https://github.com/lint-staged/lint-staged) on staged files: `vp lint --fix` on JS/TS, then `vp fmt` on everything. Fixes are added to the commit; lint errors that can't be auto-fixed block it.

```shell
pnpm format
```

## Linting

```shell
pnpm lint
```

## Unused code

[Knip](https://knip.dev) fails when a file, dependency, export, or catalog entry has no use. Configuration is [`knip.jsonc`](../knip.jsonc).

```shell
pnpm knip
```

## Vendored source

`.repos/effect` and `.repos/router` are `git subtree` checkouts of Effect and TanStack Router at the installed versions, managed by [vendor-src](https://www.npmjs.com/package/vendor-src) from `vendor-src.json`. To bump one, change its version in the root `package.json` (and the catalog in `pnpm-workspace.yaml` for Effect), run `pnpm install`, then `pnpm exec vendor-src sync`, which commits the subtree update.

## Releasing / npm publish

Both packages are released together and always share a version. The latest git tag is the version source.

The maintainer starts [`.github/workflows/release.yaml`](./workflows/release.yaml) by hand from the Actions tab. It runs [release-it](https://github.com/release-it/release-it) from the repo root, and skips when nothing under `packages/*` changed since the latest tag:

1. Computes the next version from the conventional commits since the latest tag that touch `packages/*`, and updates `CHANGELOG.md`. `feat`, `fix`, and `perf` decide the bump; the other types are listed without bumping, and a release with none of the three is a patch.
2. Writes the version into each `packages/*/package.json`.
3. Checks `main` hasn't moved since the run checked it out; if it has, it stops and leaves the release to a later run.
4. Builds, then publishes `effect-atom-boundary` and `raf-effect-atom` (each `pnpm pack` + `npm publish`, using npm trusted publishing over OIDC, no `NPM_TOKEN`). `pnpm pack` rewrites `workspace:*` and `catalog:` to real versions.
5. Only after publishing: commits `chore: release vX.Y.Z`, tags, pushes, and creates a GitHub Release.

Do not set `NODE_AUTH_TOKEN` / `NPM_TOKEN` in the release job: a placeholder token disables OIDC.

### One-time setup

1. **GitHub secret `ACCESS_TOKEN`**: a PAT that can push to `main` and create releases.
2. **First publish from your machine.** npm only lets you add a trusted publisher to a package that already exists, so each package is published once by hand, with provenance off:

   ```shell
   npm login
   pnpm build
   for pkg in effect-atom-boundary raf-effect-atom; do
   	(cd packages/$pkg && pnpm pack --out package.tgz && npm publish package.tgz --access public --provenance=false && rm package.tgz)
   done
   ```

3. **Trusted publisher** for each package, pointing at this repo's release workflow:

   ```shell
   npm trust github effect-atom-boundary --file release.yaml --repo KATT/raf-effect-atom --allow-publish -y
   npm trust github raf-effect-atom --file release.yaml --repo KATT/raf-effect-atom --allow-publish -y
   ```
