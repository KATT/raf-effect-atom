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
| `tooling/og-image`             | The sites' social cards (`og:image`), rendered at build time   |

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

Also run the docs site's build (`pnpm build:www`) when `www`, its samples or the packages changed. When an example app or the packages changed, build the examples (`pnpm -r --filter "./examples/*" build`), then run their `check:bundle` and `test:browser` scripts the same way. `test:browser` drives Google Chrome against each app's production build.

## Commits

Every commit subject is a [conventional commit](https://www.conventionalcommits.org/en/v1.0.0/): `type(scope)!: description`, with a type from `release-it/<package>.json` (`feat`, `fix`, `perf`, `build`, `chore`, `ci`, `docs`, `refactor`, `style`, `test`). Breaking changes mark the type with `!`. The `commit-msg` hook rejects other subjects, and the `Commits` workflow checks every commit a push brings to `main`. release-it reads these subjects for the changelog and the version bump.

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

## CodeSandbox examples

The [Examples](https://raf-effect-atom.katt.dev/docs/examples) page opens each example app on [CodeSandbox](https://codesandbox.io) from the `codesandbox` branch. That branch holds a standalone pnpm workspace per app in `examples/<app>`: the app in `apps/<app>`, and every workspace package it depends on (the libraries, `examples/.shared/*`, `tooling/og-image`, `tooling/bundle-check`) in `packages/`, with `.codesandbox/tasks.json` to install and start the dev server. [`tooling/codesandbox`](../tooling/codesandbox) writes it, and [`.github/workflows/codesandbox.yaml`](workflows/codesandbox.yaml) regenerates, installs, builds and pushes it after each push to `main` that changes what it copies. Don't edit the branch by hand.

To try a copy locally:

```shell
pnpm --filter @tooling/codesandbox generate /tmp/codesandbox
cd /tmp/codesandbox/examples/nextjs && pnpm install && pnpm dev
```

The apps' dev servers allow CodeSandbox's preview host, `*.csb.app` (Vite's `server.allowedHosts`, Next.js's `allowedDevOrigins`).

## Releasing / npm publish

Each package has its own version, changelog (`packages/<package>/CHANGELOG.md`) and tag (`effect-atom-boundary@x.y.z`). Its latest tag is the version source, and only commits that touch its directory count. Each has a release-it config in [`release-it/`](../release-it).

The maintainer starts [`.github/workflows/release.yaml`](./workflows/release.yaml) by hand from the Actions tab, for all packages or one. A gate picks the packages with commits since their own latest tag, then runs [release-it](https://github.com/release-it/release-it) from the repo root for each, one after the other:

1. Computes the next version from the conventional commits since the package's latest tag that touch `packages/<package>`, and updates its `CHANGELOG.md` (the first release writes its whole history). `feat`, `fix`, and `perf` decide the bump; the other types are listed without bumping, and a release with none of the three is a patch.
2. Writes the version into `packages/<package>/package.json`.
3. Builds the package and copies the root `LICENSE` into it.
4. Checks `main` hasn't moved since the run checked it out; if it has, it stops and leaves the release to a later run.
5. Publishes the package (`pnpm pack` + `npm publish`, using npm trusted publishing over OIDC, no `NPM_TOKEN`). `pnpm pack` rewrites `workspace:*` and `catalog:` to real versions.
6. Only after publishing: commits `chore(release): <package>@x.y.z`, tags it `<package>@x.y.z`, pushes, and creates a GitHub Release.

Do not set `NODE_AUTH_TOKEN` / `NPM_TOKEN` in the release job: a placeholder token disables OIDC.

### One-time setup

1. **GitHub secret `ACCESS_TOKEN`**: a PAT that can push to `main` and create releases.
2. **First publish from your machine.** npm only lets you add a trusted publisher to a package that already exists, so each package is published once by hand, with provenance off:

   ```shell
   npm login
   pnpm build
   for pkg in effect-atom-boundary raf-effect-atom; do
   	cp LICENSE packages/$pkg/LICENSE
   	(cd packages/$pkg && pnpm pack --out package.tgz && npm publish package.tgz --access public --provenance=false && rm package.tgz)
   done
   ```

3. **Trusted publisher** for each package, pointing at this repo's release workflow:

   ```shell
   npm trust github effect-atom-boundary --file release.yaml --repo KATT/raf-effect-atom --allow-publish -y
   npm trust github raf-effect-atom --file release.yaml --repo KATT/raf-effect-atom --allow-publish -y
   ```
