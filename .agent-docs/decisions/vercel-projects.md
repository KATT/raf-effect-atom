# One Vercel project per app, configured in its `vercel.json` (human asked)

- Human: the apps deploy on Vercel the way raf-query's do, under `*.raf-effect-atom.katt.dev`. The human creates the Vercel projects and domains once the apps build; agents don't.
- Every deployed app (`www`, `examples/tanstack-start`, `examples/nextjs`, `examples/react-router`) has a `vercel.json` in its directory, and the project's root directory is that directory, with files outside it included:

  ```json
  {
  	"$schema": "https://openapi.vercel.sh/vercel.json",
  	"buildCommand": "pnpm build",
  	"framework": "tanstack-start",
  	"ignoreCommand": "sh ../../tooling/vercel-ignore/ignore.sh",
  	"installCommand": "pnpm install --frozen-lockfile"
  }
  ```

  `framework` is `nextjs` for the Next.js app and `react-router` for the React Router app (as raf-query's `examples/react-router/vercel.json`; its app sets `ssr: true` in `react-router.config.ts` and uses no Vercel preset). `www` is one level down, so its `ignoreCommand` is `sh ../tooling/vercel-ignore/ignore.sh` ([vercel-ignore-build-step.md](./vercel-ignore-build-step.md)).

- Node: the repo pins Node 26 (`.nvmrc`, CI, root `engines`), but Vercel offers only 24.x and 22.x (checked 2026-10-23 against [Supported Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions) and the project API's `nodeVersion` enum). Projects use the highest Node Vercel offers, 24.x today, and move to 26.x once Vercel lists it. App `package.json` files don't set `engines.node`: Vercel reads it from the project's root directory as an override, and a range it can't satisfy fails the build. Code that deploys must still run on Vercel's Node until then.
- Project settings live in Vercel, as in raf-query: GitHub `KATT/raf-effect-atom`, `ENABLE_EXPERIMENTAL_COREPACK=1` in every environment (so Vercel's install uses `packageManager`'s pnpm), "skip unaffected projects" on, no Vercel Authentication. Pushes to `main` deploy to production.
- The TanStack Start apps build with Nitro's `nitro()` Vite plugin, which writes Vercel Build Output on Vercel. `www` is fully prerendered, so it serves from the CDN with no functions.
- Planned hostnames (the human sets them): `raf-effect-atom.katt.dev` (docs), `tanstack-start.raf-effect-atom.katt.dev`, `nextjs.raf-effect-atom.katt.dev`, `react-router.raf-effect-atom.katt.dev`. Verify against the project settings before linking any of them.
