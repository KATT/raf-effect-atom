# The rules for coding agents are one docs page, inlined at the top of llms.txt (agent)

- **One source.** `www/content/coding-agents.md` holds the do and avoid rules, each with its reason and a link to the page that explains it. Everything else links to it instead of copying it:
  - `llms.txt` and `/index.md` inline its body after the intro, through the content plugin's `agentRules` option, because many agents read only that file;
  - both package READMEs have a short "For coding agents" section with the rules that package owns, linking the page and `llms.txt`;
  - the root README points agents at `llms.txt`;
  - the overview's "Where to go next" links the page.
- **No headings in the inlined copy.** llms.txt's format keeps `##` headings for the page lists, so the build turns the page's headings into bold lines there. The page itself keeps `## Do` and `## Avoid` for its table of contents.
- **The rules match what the library checks.** Starting atoms before render is enforced in development by `WaterfallDetection` (see `waterfall-detection.md`); the page tells agents to keep it on `throw` and to fix what it reports rather than switch it off or reach for `useWaterfall`.
- **The examples follow the rules**, and the docs' samples do too except where a page shows what a rule prevents. `AGENTS.md` says so.
- Rejected:
  - a separate `AGENTS.md` or rules file to publish in the packages (one more copy to keep in sync; the READMEs already ship and link the page);
  - rules only on the docs page (agents that read only `llms.txt` would miss them);
  - copying the full rules into each README (`AGENTS.md` keeps READMEs a short taste that links the docs).
