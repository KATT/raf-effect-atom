# Docs split (human in raf-query, kept)

- `www/content`: the documentation, served by the docs site. Guides, the API reference and every public behavior live here, once.
- Root `README.md`: a taste for GitHub. The pitch, the early-status note, one code sample, install, packages, examples, and links into the docs. No guides or reference tables.
- `packages/<name>/README.md`: committed per package and shown on npm. What the package is for, install, a short sample, absolute links into the docs. Each package's `prepack` copies the root `LICENSE` and `CHANGELOG.md` in (gitignored inside `packages/*`).
- `AGENTS.md`: short environment and pointers agents need every session. `.agent-docs/`: durable agent notes.
