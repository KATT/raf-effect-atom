# Agent docs

Working memory for coding agents on this repo. **Agents own this folder**: create, edit, and delete freely. Prefer durable facts over chat transcript fluff.

| Doc                        | What belongs here                                                                 |
| -------------------------- | --------------------------------------------------------------------------------- |
| [decisions/](./decisions/) | Choices (human or agent) that later work should not quietly reverse, one per file |
| [origin.md](./origin.md)   | What the name means, where the repo comes from, and the tooling baseline          |

## Rules of thumb

- Put **product intent and public API** in the docs site's pages, `www/content` (human-facing, "how it works now"). The root and package READMEs only link there.
- Put **why we did X / don't do Y** here so future sessions don't re-litigate or re-discover.
- When a decision is superseded, update or delete it; don't accumulate archaeology.
- Don't duplicate `.github/DEVELOPMENT.md` (how to build and test) or `AGENTS.md` (session boot instructions).

## Decisions

- **A new decision is a new file**: `decisions/<topic>.md`, kebab-case, named by topic. No dates or sequence numbers in the name, and no index file. Changing a decision edits its file; reversing one deletes or rewrites it.
- Each file starts with `# Title (who)`, then short bullets: what was decided, the reason, what lost, and the files it lives in. `(human …)` marks what the human decided or asked for: don't reverse it without asking. `(agent)` is open to revision with a good reason.
- Decisions carried over from [raf-query](https://github.com/KATT/raf-query) are rewritten for this repo. Their history stays in raf-query; `git log` there has it.
- Find decisions with `head -n 1 .agent-docs/decisions/*.md` for the titles, or `rg <term> .agent-docs/decisions`.

## Digging deeper with git

Commits land on `main` directly, so the commit body is where the longer reasoning lives (what a PR description would have held).

- `git log -p -- .agent-docs/decisions/<topic>.md`: every change to the file, with each commit's reasoning.
- `git blame -C -C .agent-docs/decisions/<topic>.md`, then `git show <sha>`. `-C -C` follows lines moved between files.
- `git log -S '<distinctive phrase>' --oneline` finds the commit that added a line wherever it lived.
