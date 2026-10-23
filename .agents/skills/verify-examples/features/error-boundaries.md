# Error boundaries

Typed failures from the server are caught by name, in the browser, by the boundary around the part of the page they belong to. Signed out, every page shows the auth boundary with a `Sign in` button. A well-formed id with no issue shows the issue boundary. URLs that aren't pages, and ids that aren't issue ids, show `Nothing here.`

## Sub-features

- `boundary-auth` signed out, the page shows `You're signed out, so the server refuses every request.` and `button "Sign in"`, which signs in and reloads. It's marked `data-boundary="AuthBoundary"` and `data-tag="Unauthorized"`.
- `boundary-issue` `/<verb>/issues/999` shows `Issue #999 doesn't exist.`, marked `IssueBoundary` / `IssueNotFound`, inside the normal header and settings bar.
- `nf-route` an unknown path such as `/nope` answers 404 with `Nothing here.`
- `nf-bad-id` `/prefetch/issues/abc` and `/prefetch/issues/0` answer 404 with `Nothing here.`

## How to get to it (user POV)

- Choose `Signed out` in the header's `Session` select.
- Type or follow a bad URL.

## Driving it with control-examples

Preconditions:

- Baseline state (42 issues).

Name the boundary on screen with this expression (`$CAUGHT`):

```bash
CAUGHT='[...document.querySelectorAll("[data-boundary]")].map(e => e.dataset.boundary + ":" + e.dataset.tag)'
```

Commands:

- **Missing issue, every verb.** For `v` in `prefetch ensure fetch`: `$CE open $U/$v/issues/999; $CE wait --text "doesn't exist"; $CE eval "$CAUGHT"`. `["IssueBoundary:IssueNotFound"]`, and `$CE text` still has the header (`raf-effect-atom · <framework>`, such as `raf-effect-atom · React Router`). The failure came with the page: `$CE eval 'performance.getEntriesByType("resource").filter(e => new URL(e.name).pathname.startsWith("/rpc")).length'` is `0`.
- **Signed out.** `$CE select --name Session --value 'Signed out'`, wait for the reload, `$CE eval "$CAUGHT"`: `["AuthBoundary:Unauthorized"]`. `$CE click --role button --name 'Sign in'; $CE wait --text Showing`: back to the list.
- **Unknown path.** `curl -s -o /dev/null -w '%{http_code}\n' $U/nope` is `404`. `$CE open $U/nope; $CE text | grep -E '^Nothing here\.$'`.
- **Bad id.** The same for `$U/prefetch/issues/abc` and `$U/prefetch/issues/0`: `404`, `Nothing here.`

## Gotchas

- Under `ensure` and `fetch`, a missing issue's boundary is in the server's HTML on TanStack Start and React Router, with a `200`. Under `prefetch`, and on Next.js, it renders in the browser, so `curl` doesn't see it; React Router answers `500` there, and when signed out. See [server rendering](server-rendering.md). Assert what the page shows with `$CE`.
- Where the failure is thrown on the server, the production server logs `Error in renderToReadableStream` with the claimed error. The browser console logs React's report of the caught error in every case, since the hydrated page throws it to the boundary again; `$CE open` prints that stack. Both are expected for a claimed failure.
- The typed failure crosses intact: `issue-not-found.test.ts` in each app (`src/` or `app/`) checks that a server-side `IssueNotFound` hydrates in the browser as an `IssueNotFound` instance. Next.js checks it in Chrome instead, in `src/hydration.test.ts`: the boundary shows `IssueNotFound` under every verb without calling `/rpc`.
