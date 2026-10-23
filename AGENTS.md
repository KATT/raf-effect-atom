## Environment

- Node is pinned in `.nvmrc`. The default shell Node may be older; switch first (`fnm use`, `nvm use`, or put `~/.nvm/versions/node/v<version>/bin` first on `PATH`).
- pnpm comes from `packageManager` through corepack, which Node 24 bundles: run `corepack enable` once per Node install.
- If `pnpm` fails with `Cannot find module .../corepack/v1/pnpm/<version>/bin/pnpm.cjs`, the installed corepack can't launch the pnpm version in `packageManager`. Upgrade corepack (`npm i -g corepack@latest`) or call the cached binary directly: `~/.cache/node/corepack/v1/pnpm/<version>/pnpm`.

## Commits go straight to `main`

- No feature branches and no pull requests. Commit each step that works and push it to `origin main` right away (`git push origin main`).
- Before every push, run the checks in [`.github/DEVELOPMENT.md`](.github/DEVELOPMENT.md#before-you-push): tests, typecheck, lint, format, knip, `pnpm build && pnpm check:pack` when the packages changed, and the `www` build when `www`, its samples or the packages changed. Never push a commit you know is red.
- If CI on `main` goes red, the next commit fixes it, before anything else.
- Never force push, rewrite `main`'s history, or amend a pushed commit. Fix forward.
- Every subject is a [conventional commit](https://www.conventionalcommits.org/en/v1.0.0/) (`type(scope)!: description`, types from `release-it/<package>.json`). The `commit-msg` hook and the `Commits` workflow check it, because release-it reads these subjects for the changelog and the version bump.
- release-it reads the body too, so the same checks reject two things in it. A `#N` may only appear in a `Refs: #N` / `Fixes: #N` footer or as the subject's trailing `(#N)`, and only for this repo's own issues and PRs; anywhere else the changelog links it as one, so write "issue 41" or use backticks. A `BREAKING CHANGE:` footer must be one line in the last paragraph ([details](.github/DEVELOPMENT.md#commits)).
- The commit body holds what a PR description would: what changed, the alternatives you rejected and why, and what you verified. Durable decisions also go in `.agent-docs/decisions/`.
- Never run release-it or `npm publish`. The Release workflow publishes on its own after CI passes on `main`, for every package with commits under `packages/<package>/` since its last tag, so a green push that touches a package ships it. Breaking changes still land straight on `main`: mark them with `!`, and while a package is 0.x they bump the minor.

## Verifying changes

- Test programmatically: unit tests, type checks, builds, `curl` against a dev server or a deployment.
- Drive the example apps and the site's demos with headless Chrome, and check RPC requests with `curl` against the apps' RPC routes. The `verify-examples` skill ([`.agents/skills/verify-examples`](.agents/skills/verify-examples/SKILL.md)) launches the apps, drives them, and has a recipe per feature. Only use computer use for things that need taste: how a UI looks or feels.
- Don't record videos or screen recordings.
- After pushing a change to `www` or an example, check that its production Vercel deployment is Ready and that the changed page or route works there. **Never guess a hostname**: copy it from the Vercel project's settings or the deployment.

## Code

- Write all the logic you can in Effect: libraries, build steps, CI and deploy scripts, tooling. Files, processes, HTTP and env go through Effect's services (`FileSystem`, `Path`, `ChildProcessSpawner`, `HttpClient`, `Config`), provided by `NodeServices.layer` at the edge, not `node:fs` / `node:child_process` / `process.env`. Plain code only where Effect can't run, such as a sync React render path. Read `.repos/effect` (start with `LLMS.md`) for the idioms. See [`.agent-docs/decisions/effect-everywhere.md`](.agent-docs/decisions/effect-everywhere.md).
- How Effect Atom, Effect RPC and TanStack Router behave is answered by their vendored source in `.repos/`, not by memory or web search.
- The example apps follow the rules in [`www/content/coding-agents.md`](www/content/coding-agents.md), and so do the docs' samples except where a page shows what a rule prevents: atoms start in loaders, server components or event handlers, and the apps keep `<WaterfallDetection mode="throw">`.

## Documentation

- The docs site's pages (`www/content`) are the full documentation, API reference included. The root `README.md` and each package's `README.md` are a short taste that links there: don't copy guides or reference tables into them.
- The docs and READMEs describe how the libraries work **now**. No history: no "since vX", "previously", "no longer", or migration notes. Version history belongs in `CHANGELOG.md` (generated from commit subjects on release), so put that context in the commit body instead.
- When the docs name a third-party API, option, or concept (TanStack Router's `loader`, Next.js's `headers()`, an Effect module), link its official documentation at its first mention on the page. Check that each link and anchor resolves.
- [`.agent-docs/`](.agent-docs/) is agent-owned working memory (decisions, bootstrap context, notes worth keeping across sessions). Read it when starting non-trivial work; update it when you learn or decide something durable. See [`.agent-docs/README.md`](.agent-docs/README.md).
- Decisions are one file each in `.agent-docs/decisions/`: add a new file rather than appending to an existing one. They hold the short version; the full reasoning is the body of the commit that wrote them (`git log -- <file>`).

<!-- vendor-src:start -->

## Vendored Source

Source for this project's key dependencies is vendored under `.repos/`, pinned to the installed versions. When a question is about how one of these libraries actually behaves, read its vendored source — implementation, tests, examples — instead of relying on docs, memory, or web search. The trees are read-only reference material; see `.repos/AGENTS.md` before touching or citing them.

### Vendored packages

- `effect@4.0.6` → `.repos/effect`
- `@tanstack/react-router@1.170.46` → `.repos/router`

<!-- vendor-src:end -->
