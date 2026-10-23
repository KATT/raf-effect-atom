# Work lands as commits pushed straight to `main` (human)

- Human: no feature branches and no pull requests. Each step that works is a commit, pushed to `origin main` right away. This replaces raf-query's stacked PRs, ready-for-review PRs, PR template and PR title check.
- Before each push the local checks run (`.github/DEVELOPMENT.md` → "Before you push"). A commit known to be red is never pushed. If CI on `main` goes red, the next commit fixes it before other work.
- Never force push, rewrite `main`, or amend a pushed commit: fix forward.
- The commit body holds what a PR description would have: what changed, the alternatives rejected, and what was verified. Durable decisions still get a file here.
- Lives in `AGENTS.md` ("Commits go straight to `main`").
