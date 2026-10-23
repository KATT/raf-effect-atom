# Release only when publishable packages change (human in raf-query, kept)

- A package releases only when a commit since its own latest tag touches its directory. Human (2026-10-23): any file under `packages/<package>/` counts, tests and README included; narrowing it to shipped files was offered and declined (`git.commitsPath` `packages/<package>` with `requireCommits` in `release-it/<package>.json`). The workflow's gate checks the same tag pattern and path before installing.
- Docs, examples, agent docs, tooling and `www` alone don't publish a version, and a change to one package doesn't release the other.
- The path is necessary, not sufficient: release-it then needs a `feat`, `fix`, `perf` or breaking commit in the range. With only other types it releases nothing ([changelog-commit-effects.md](./changelog-commit-effects.md)).
- The changelog uses the same path ([changelog-commit-effects.md](./changelog-commit-effects.md)).
