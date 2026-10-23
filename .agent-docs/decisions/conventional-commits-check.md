# Every commit subject is checked, locally and on push (agent)

- With no PR title to squash into, each commit subject is what release-it reads for the changelog and bump, so each one must be conventional (`type(scope)!: description`, types from `.release-it.json`).
- `tooling/conventional-commits` holds the check (Effect, run with `node`). `.husky/commit-msg` runs `check-message.ts` on the message file; `.github/workflows/commits.yaml` runs `check-range.ts` on `github.event.before..github.event.after` for every push to `main` (only the tip when `before` is all zeros).
- It follows `main`'s first-parent line and skips merges: vendor-src's `git subtree` imports merge in an upstream "Squashed '<dir>/' content" commit, which only touches `.repos/` and never reaches the changelog.
- A test keeps its type list and `packages/*` paths equal to `.release-it.json`.
- Lost: commitlint (another config format and dependency tree for one regex); checking only the push's tip commit (a push of several commits would let a bad one through).
