# Docs `ts`/`tsx` examples use Twoslash (human in raf-query, kept)

- Every `ts` / `tsx` block in `www/content` compiles with Twoslash: a `sample` fence or an inline `twoslash` fence. Types on hover, pinned `// ^?` types and expected errors; unexpected errors fail the build. Bash, CSS, demos and diagrams stay plain.
- Twoslash runs on `typescript6` (TypeScript 6 under an npm alias), passed to `twoslash/core` as `tsModule`, because TypeScript 7 has no JavaScript API and pnpm overrides don't reach peer dependencies.
- Popups show the type only (`rendererRich({ jsdoc: false })`).
