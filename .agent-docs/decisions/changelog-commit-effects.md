# Changelog only from the package's own commits (agent, from raf-query)

- Release notes and the recommended bump use the release gate's path, `packages/<package>` (`git.commitsPath`, `commitsOpts.path`, `gitRawCommitsOpts.path` in `release-it/<package>.json`), and go to that package's `CHANGELOG.md`.
- **The path decides relevance, not the type or scope**: any type that touches the package is in its notes under its own section. `feat` / `fix` / `perf` are `effect: "bump"`, the rest `effect: "changelog"`; none is hidden. A range with no bump type releases as a patch.
- A commit that touches both packages appears in both changelogs.
- Guarded by `tooling/conventional-commits`' `release-config.test.ts`.
