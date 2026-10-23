# Lint rules reach Markdown fences through their tests (agent)

- Oxlint doesn't read Markdown. A rule that should hold in Markdown too adds `tester.run("<rule> in Markdown fences", rule, { valid: markdownFences(), invalid: [] })` to its test, so `pnpm test` fails on a violating fence, named `file:line`.
- `tooling/oxlint-plugins/markdown-fences.ts` returns every `js` / `jsx` / `ts` / `tsx` fence in git-tracked `.md` / `.mdx`, except `.repos/` and `CHANGELOG.md`. `sample` fences are skipped: their files in `www/samples` are linted as code. A fence that is only an object's members is linted inside `({ … })`.
- Vitest fails a suite with no tests, so the repo must always have at least one tracked JS/TS fence (the decisions have several).
- Per-rule opt-in, not every rule: most rules (`no-unused-vars`, `no-undef`, React Compiler) fight fragments.
