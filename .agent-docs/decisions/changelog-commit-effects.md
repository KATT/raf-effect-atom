# Changelog only from publishable package commits (agent, from raf-query)

- Release notes and the recommended bump use the release gate's path, `packages/*` (`git.commitsPath`, `commitsOpts.path`, `gitRawCommitsOpts.path` in `.release-it.json`).
- **The path decides relevance, not the type**: any type that touches `packages/*` is in the notes under its own section. `feat` / `fix` / `perf` are `effect: "bump"`, the rest `effect: "changelog"`; none is hidden. A range with no bump type releases as a patch.
- Guarded by `tooling/conventional-commits`' sync test against `.release-it.json`.
