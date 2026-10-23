# Docs code blocks that need an app are `sample` fences of real files (human in raf-query, kept)

- A block that needs the app is a ` ```sample ` fence whose one line is `<app>/<path>#region`, a path from `www/samples`. The block is that region of a real file, so the editor, `tsc` and lint see it like any other file.
- Inline `twoslash` blocks stand alone: they import packages only. They may define a tiny RPC group of their own when they don't need an app.
- A page's own blocks are `src/docs/<page>.ts(x)` in a sample app, one region per block, named after what it shows. App files (routes, atoms) are titled with their path in the app.
- An expected error is `// @ts-expect-error -- 2345: why`: `tsc` holds the file to it, and the build swaps it for Twoslash's `// @errors: 2345`.
