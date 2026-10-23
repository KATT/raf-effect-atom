# Release only when publishable packages change (human in raf-query, kept)

- release-it skips unless a commit since the latest tag touches `packages/*` (`git.commitsPath` in `.release-it.json`, with `requireCommits`); the workflow's gate job checks the same glob before installing.
- Docs, examples, agent docs, tooling and `www` alone don't publish a version.
- The glob is unquoted so the shell expands it, as release-it does. The changelog uses the same path ([changelog-commit-effects.md](./changelog-commit-effects.md)).
