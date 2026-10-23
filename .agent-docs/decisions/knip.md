# Knip (human asked in raf-query, kept)

- `pnpm knip` runs in CI; the config is `knip.jsonc`. Every issue type is `error`, including `nsExports`, `nsTypes` and `cycles`. An export used only in its own file is reported, and private workspaces report unused exports of entry files too.
- The publishable packages turn `includeEntryExports` off: their entry files are the public API.
- Not `knip --strict`: that is production mode, which skips tests and devDependencies.
- Named exceptions live in `knip.jsonc` with a comment each: `.repos/`, the packages `vp lint` / `vp fmt` load, the oxlint plugins loaded by path, and the root's vendor-src packages.
