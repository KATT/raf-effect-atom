# Docs samples compile in workspace packages in `www/samples` (human in raf-query, adapted)

- One sample app per integration, each a workspace package: `www/samples/tanstack-start`, `www/samples/nextjs` and `www/samples/react-router` (code under `app/`, as in raf-query; the lint overrides match `www/samples/react-router*/app`). `www` lists each as a `workspace:*` devDependency; blocks compile with the app as Twoslash's `vfsRoot`, so a library a block imports goes in that app's `package.json`.
- The samples are real apps that import the shared RPC contract and serve the backend the same way the examples do, so every Twoslash block shows real RPC types.
- Typecheck is each package's own `tsc` (the root `typecheck` filters `./www/samples/*`).
