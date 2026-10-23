# Changelog only from the package's own commits (agent, from raf-query)

- Release notes and the recommended bump use the release gate's path, `packages/<package>` (`git.commitsPath`, `commitsOpts.path`, `gitRawCommitsOpts.path` in `release-it/<package>.json`), and go to that package's `CHANGELOG.md`.
- **The path decides relevance, not the type or scope**: any type that touches the package is in its notes under its own section. `feat` / `fix` / `perf` are `effect: "bump"`, the rest `effect: "changelog"`; none is hidden. A range with no bump type releases nothing: release-it logs "No new version to release" and the Release job passes. Those commits are listed in, and ship with, the next release that has a `feat`, `fix`, `perf` or breaking commit. Seen 2026-10-23: a docs-only `CHANGELOG.md` fix (c21f64c) released neither package.
- A commit that touches both packages appears in both changelogs.
- Guarded by `tooling/conventional-commits`' `release-config.test.ts`.
