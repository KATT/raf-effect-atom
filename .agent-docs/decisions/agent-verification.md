# Agents verify with tests, requests and the production deploy, not videos (human)

- Verify programmatically: tests, type checks, builds, `curl` against the RPC routes. Drive the example apps and the docs site's demos with headless Chrome. Computer use only for UI judgment that needs taste.
- No video demos or screen recordings: slow and token-heavy.
- With no PRs there are no preview links to cite. After pushing a change to `www` or an example, check its **production** Vercel deployment is Ready and the changed page or route works there.
- **Never guess a hostname**: take it from the Vercel project's settings or the deployment itself. Lives in `AGENTS.md` ("Verifying changes").
