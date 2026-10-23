# raf-effect-atom docs

The documentation site at [raf-effect-atom.katt.dev](https://raf-effect-atom.katt.dev): a TanStack Start app, prerendered to static HTML, that loads its own pages as atoms started from route loaders with `raf-effect-atom/tanstack-router`.

```sh
pnpm dev        # http://localhost:3004
pnpm build      # static site in dist/client, Build Output in .vercel/output
pnpm start      # serve the build
```

## Writing pages

Pages are `content/<slug>.md`, served at `/docs/<slug>`:

```md
---
title: Error boundaries
description: One sentence for search results and social cards.
section: effect-atom-boundary # one of `sections` in src/site.ts
order: 1 # position in the section
---
```

- Link other pages as `./slug.md` or `./slug.md#heading`. The build fails on a link to a page or heading that doesn't exist.
- `> [!NOTE]`, `> [!TIP]`, `> [!WARNING]` and friends render as callouts.
- A code fence can take a title: ` ```sh title="Terminal" `.

### Types in code blocks

Every `ts` / `tsx` block is compiled with [Twoslash](https://twoslash.netlify.app): hovering a name shows its type, and a compile error the block doesn't expect fails the build. Twoslash needs TypeScript's JavaScript API, so it runs on `typescript6`.

**A `sample` fence** shows a region of a file of the sample app in `samples/tanstack-start` (`@samples/tanstack-start`), which imports the examples' shared contract:

````md
```sample
tanstack-start/src/routes/issues.$id.tsx#route
```
````

- The page shows the lines between `// #region route` and `// #endregion`, dedented. Without `#name`, it shows the whole file.
- The file compiles with every other file of the app, so it sees the route tree, the router context and the app's `Register`.
- A block that is a file of the app has its path in the app as its title. `title="…"` on the fence sets another one, `title=""` none.
- The rest of a page's blocks are in `src/docs/<page>.ts` or `.tsx`, a region per block. These get no title.
- `// ^?` under a line pins the type of the name above it.
- `// @ts-expect-error -- 2561: why` above a line shows the block's expected error 2561 on it, in place of the comment. The boundary pages use this for misspelled tags.

**A `twoslash` fence** is written inline for a block that stands on its own: it imports packages, never a file of the app. Code above `// ---cut---` compiles but isn't shown, and `// @errors: 2561` works as in Twoslash.

In both kinds, `// ---collapse---` and `// ---/collapse---` fold the lines between them.

Each compiled block is kept in `node_modules/.cache/twoslash` and reused while nothing it was compiled from changed. CI's Build www job keeps the directory in the Actions cache. Delete it to compile everything again.

Code outside the pages imports a region instead of writing a fence: `import hero from "sample:tanstack-start/src/routes/issues.$id.tsx#hero"` (the homepage does this).

## API reference

The API reference (`/docs/api` and a page per entrypoint) is generated on every build from the packages' `exports`, types and JSDoc (`build/api-reference.ts`, `build/api-pages.ts`); it has no files in `content/`. Each export's anchor is its name (`/docs/api-raf-effect-atom#Loader.ensure`), and inline code in any page that names an export links to it at its first mention. `pnpm test` fails when a public export has no JSDoc.

## Demos

A fenced `demo` block embeds a live demo:

````md
```demo
per-atom-boundary
```
````

The name is a file in `src/demos/`, loaded only in the browser.

## For agents

- `/docs/<slug>.md` is the page's markdown, and a page's own URL answers with it when the request's `Accept` header has `text/markdown`.
- `/llms.txt` lists every page and `/llms-full.txt` has every page in one file.

```sh
curl -H 'Accept: text/markdown' http://localhost:3004/docs/error-boundaries
```

## Deploying

The Vercel project's root directory is `www`. The build ends with `build/bin/vercel-output.ts`, which writes [Build Output](https://vercel.com/docs/build-output-api/v3) to `.vercel/output`: the static files, cache headers and the `Accept: text/markdown` routes. `vercel.json` sets the install and build commands, and skips the deployment when nothing `www` depends on changed (`tooling/vercel-ignore`). Vercel needs Node 24 (the root `package.json`'s `engines`) and pnpm from `packageManager` (set `ENABLE_EXPERIMENTAL_COREPACK=1`).
