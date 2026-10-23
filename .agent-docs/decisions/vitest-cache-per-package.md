# Vitest module cache: one per package (agent)

- Every Vitest config sets `test.fsModuleCachePath: "node_modules/.vitest-cache"`, which resolves against the package's root. A new package with tests copies the line.
- Why: Vitest 5 defaults the cache to one directory at the workspace root, shared by every package. Before each run, every `vp test` compares the lockfile hash in that cache's `_metadata.json` and, when the lockfile has changed, deletes the directory. `pnpm test` runs the packages in parallel, so after a lockfile change one process's `rm -r` met another's fresh writes and failed with `ENOTEMPTY`; the rerun passed because the first run had stored the new hash.
- Lost: `pnpm -r --workspace-concurrency=1` (serial, slower), `fsModuleCache: false` (no cache), and wiping the cache before every run (no cache across runs). Per-package caches are where Vite already keeps its own (`node_modules/.vite`).
- `examples/nextjs` has no setting: its only Vitest run is `test:browser`, which CI runs on its own.
