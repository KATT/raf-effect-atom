# Release only when publishable packages change (human in raf-query, kept)

- A package releases only when a commit since its own latest tag touches its directory (`git.commitsPath` `packages/<package>` with `requireCommits` in `release-it/<package>.json`). The workflow's gate checks the same tag pattern and path before installing.
- Docs, examples, agent docs, tooling and `www` alone don't publish a version, and a change to one package doesn't release the other.
- The changelog uses the same path ([changelog-commit-effects.md](./changelog-commit-effects.md)).
