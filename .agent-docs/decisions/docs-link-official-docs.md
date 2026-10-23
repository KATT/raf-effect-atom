# Docs link third-party APIs to their official documentation (human)

- The first mention on a page of another library's API, option or concept links its official docs (effect.website, tanstack.com, nextjs.org, react.dev, MDN). Deep-link the exact API or heading. Later mentions on the same page stay plain.
- Check each URL and anchor before committing (`curl -sL` and grep the page for `id="<anchor>"`). Effect 4's docs live under `effect.website/docs/v4/`; when a page has no docs yet, link the module's source on GitHub at the installed tag.
