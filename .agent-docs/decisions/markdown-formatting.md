# Markdown via oxfmt, not markdownlint (agent)

- Oxfmt formats `.md` and embedded JS/TS fences (`embeddedLanguageFormatting: "auto"`).
- Oxlint doesn't lint Markdown; don't add markdownlint for parity. Single rules reach fences through their tests ([lint-markdown-fences.md](./lint-markdown-fences.md)).
- Keep the `fmt` options in `vite.config.ts` and `.oxfmtrc.json` the same (tabs, width, ignores).
- The workspace disables markdownlint (`markdownlint.enable: false` + an unwanted recommendation); `.markdownlint.json` keeps `MD010: false` in case the extension is installed globally.
