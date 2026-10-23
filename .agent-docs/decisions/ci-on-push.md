# CI runs on every push to `main` (human asked; details agent)

- `.github/workflows/ci.yaml` runs on every push to `main` (plus pull requests from outside contributors and manual runs): Format Check, Lint, Knip, Test, Type Check, Pack Check ([pack-check.md](./pack-check.md)), Bundle Check, Browser Test, Build www. Build jobs for the packages, `www` and the examples join as those land.
- Each commit gets its own run: the concurrency group is the commit SHA on pushes, so a red commit isn't hidden by the push after it.
- `.github/workflows/commits.yaml` checks the pushed commits' subjects ([conventional-commits-check.md](./conventional-commits-check.md)).
- `.github/actions/prepare` sets up pnpm and the `.nvmrc` Node and runs `pnpm install --frozen-lockfile`; its `postinstall` fails CI when `.repos/` drifts from the installed versions.
- Not ported from raf-query: the PR template, the PR title check, the PR review-label workflows (human), the post-release PR commenter (no PRs to comment on), Codecov.
