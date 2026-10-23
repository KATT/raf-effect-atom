# One Vercel project per app, configured in its `vercel.json` (human asked)

- Human: the apps deploy on Vercel the way raf-query's do, under `*.raf-effect-atom.katt.dev`. The human creates the Vercel projects and domains once the apps build; agents don't.
- Every deployed app (`www`, `examples/tanstack-start`, `examples/nextjs`) has a `vercel.json` in its directory, and the project's root directory is that directory, with files outside it included:

  ```json
  {
  	"$schema": "https://openapi.vercel.sh/vercel.json",
  	"buildCommand": "pnpm build",
  	"framework": "tanstack-start",
  	"ignoreCommand": "sh ../../tooling/vercel-ignore/ignore.sh",
  	"installCommand": "pnpm install --frozen-lockfile"
  }
  ```

  `framework` is `nextjs` for the Next.js app. `www` is one level down, so its `ignoreCommand` is `sh ../tooling/vercel-ignore/ignore.sh` ([vercel-ignore-build-step.md](./vercel-ignore-build-step.md)).

- Project settings live in Vercel, as in raf-query: GitHub `KATT/raf-effect-atom`, Node 24, `ENABLE_EXPERIMENTAL_COREPACK=1` in every environment (so Vercel's install uses `packageManager`'s pnpm), "skip unaffected projects" on, no Vercel Authentication. Pushes to `main` deploy to production.
- The TanStack Start apps build with Nitro's `nitro()` Vite plugin, which writes Vercel Build Output on Vercel. `www` is fully prerendered, so it serves from the CDN with no functions.
- Planned hostnames (the human sets them): `raf-effect-atom.katt.dev` (docs), `tanstack-start.raf-effect-atom.katt.dev`, `nextjs.raf-effect-atom.katt.dev`. Verify against the project settings before linking any of them.
