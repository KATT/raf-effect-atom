# Vercel skips a build by diffing from the last deployment (human asked in raf-query, kept)

- `ignoreCommand` in every `vercel.json` is `sh <path to>/tooling/vercel-ignore/ignore.sh`, run from the project's root directory. It installs `@tooling/vercel-ignore` alone (`--frozen-lockfile --prod --ignore-scripts --filter`) with the pnpm in `packageManager` through `npx`, because Vercel's own pnpm can't read this lockfile at that point, then runs `src/bin/ignore.ts` (Effect).
- It builds when the project, any workspace package it reaches through `workspace:` dependencies (transitively, from `pnpm-workspace.yaml`'s globs), or a root install input (`package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `.npmrc`, `patches`) changed since `$VERCEL_GIT_PREVIOUS_SHA`, the project's last successful deployment. With every commit on `main`, a push of several commits is diffed as a whole, not just its tip.
- Every failure (install, git, a missing SHA) builds: Vercel only documents 0 (skip) and 1 (build). `ignoreCommand` is capped at 256 characters, so logic lives in `ignore.sh` or the Effect code.
- The remote for a branch's first deployment is `https://github.com/KATT/raf-effect-atom.git` (`src/bin/ignore.ts`).
- Lost: `turbo query affected` (no Turborepo); `HEAD^` (only the tip commit); a Node-built-ins script (see [effect-everywhere.md](./effect-everywhere.md)).
