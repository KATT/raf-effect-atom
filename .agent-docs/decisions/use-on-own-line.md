# `use()` on its own line (human)

- Read a promise with `const post = use(postPromise);`, then `post.title`. Never `use(postPromise).title`, `use(p).map(…)` or `use(p)[0]`: the line that can suspend stays visible, and the value has a name.
- Enforced by `workspace/no-use-member-access` (`tooling/oxlint-plugins/no-use-member-access.ts`) everywhere: apps, docs samples, tests, and Markdown fences (see [lint-markdown-fences.md](./lint-markdown-fences.md)).
