# `effect-atom-boundary` credits result-rpc (human asked)

- The typed error boundary idea comes from [result-rpc](https://result-rpc.com/): its [Shells](https://result-rpc.com/concepts/shells/) are error boundaries for values that claim failure classes and subtract what they own from the component's error union. `effect-atom-boundary` is that idea over Effect Atom, claiming by `_tag`.
- The credit goes in `packages/effect-atom-boundary/README.md` (shown on npm) and on the docs site's error boundaries page, linking `https://result-rpc.com/` and, where the page explains claiming, the Shells page. raf-query's docs also have a credits page; when `www` gets one, result-rpc is on it.
- Both links returned 200 on 2026-10-23. Check them again when writing the README or the page (AGENTS.md: every link resolves).
- result-rpc's [client boundary](https://result-rpc.com/concepts/client-boundary/) page makes the same contract-vs-handlers split this repo uses for its example backend; the decision for that split links it too.
