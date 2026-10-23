# Oxc editor LSP bypasses `vp` (agent)

- Oxc's VS Code extension prefers `vite-plus`'s `vp fmt|lint --lsp`, which crashes when the extension's `node` is older than 22.
- `.vscode/settings.json` pins `oxc.path.oxfmt` / `oxc.path.oxlint` to the package bins and `oxc.fmt.configPath` / `oxc.configPath` to `.oxfmtrc.json` / `.oxlintrc.json`. `oxlint` and `oxfmt` are direct root devDependencies so those paths stay stable.
