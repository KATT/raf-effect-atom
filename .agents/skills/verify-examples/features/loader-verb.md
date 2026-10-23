# Loader verb

The `Loader` select in the header picks how each route's loader starts its atoms: `prefetch`, `ensure` or `fetch`. The verb is the URL's first segment (`/ensure/issues/3`), so a page under each verb can be opened, compared and shared. A line under the selects names the current verb and says what it waits for.

## Sub-features

- `verb-url` `/prefetch/…`, `/ensure/…`, `/fetch/…` serve the same pages. `/` and the verb-less `/issues…` URLs redirect to the same page under `prefetch`. Any other first segment is the not-found page.
- `verb-picker` `combobox "Loader"` with options `prefetch`, `ensure`, `fetch`; its value is the URL's verb. Choosing one navigates to the current page and search under that verb.
- `verb-hint` `prefetch` says `Never waits…`, `ensure` says `Waits for results the registry doesn't have…`, `fetch` says `Waits for fresh results…`.
- `verb-links` every in-app link (header, rows, filters) stays under the current verb.
- `verb-prefetch` never waits: a click opens the new page at once, onto skeletons. Its first HTML has skeletons, and the data streams in after.
- `verb-ensure` waits for what the browser's registry doesn't hold: the old page stays until the data lands. A revisit within the query's time to live (1 minute) opens at once with no request.
- `verb-fetch` always waits for fresh data: a revisit keeps the old page until the refresh lands.

## How to get to it (user POV)

- The header of every page: the first select, and the line under the selects.

## Driving it with control-examples

Preconditions:

- Baseline state. For the waiting recipes, set `Latency` to `3 s` first, so the waits are long.

Name which page is on screen with this expression (`$PAGE`): `list` while the list is still shown, `issue` once the issue page has rendered (skeletons count).

```bash
PAGE='document.querySelector("main").innerText.includes("Showing") ? "list" : "issue"'
RPC='performance.getEntriesByType("resource").filter(e => new URL(e.name).pathname.startsWith("/rpc")).length'
```

Commands:

- **Redirects.** `curl -s -o /dev/null -w '%{redirect_url}\n' $U/issues/3` is `$U/prefetch/issues/3`; `curl -s -o /dev/null -w '%{http_code}\n' $U/bogus/issues/3` is `404`.
- **Switch verb.** `$CE open "$U/prefetch/issues?status=open&sort=newest"; $CE select --name Loader --value ensure; $CE wait --text "registry doesn't have"`. `$CE eval 'location.pathname + location.search'` is `/ensure/issues?status=open&sort=newest`, and `$CE snapshot | grep 'link "#'` rows link to `/ensure/issues/<id>`.
- **First HTML.** `curl -s -b db-latency=0 $U/ensure/issues/3 | grep -o animate-pulse | wc -l` is lower than under `/prefetch/` (the issue's own skeleton is gone; the comments and assignee are prefetched in both). On React Router and Next.js the counts are equal (see Gotchas); compare when the response starts instead: `curl -s -A Mozilla/5.0 -o /dev/null -w '%{time_starttransfer}\n' -b db-latency=3000 $U/<verb>/issues/3` is under a second for `prefetch` and about 1.5-4.5 s for `ensure` and `fetch`.
- **prefetch opens at once.** `$CE open $U/prefetch/issues; $CE wait --role link --name '/^#41 /'; $CE click --role link --name '/^#41 /'; $CE eval "$PAGE"` is `issue` right away; the title fills in about 3 s later.
- **ensure waits once.** Same with `/ensure/`: `list` right after the click, `issue` once the data lands. Then `$CE click --role link --name Issues --exact`, wait for the rows, note `$CE eval "$RPC"`, click `#41` again: `issue` at once, and `$RPC` hasn't grown.
- **fetch waits every time.** Same with `/fetch/`: the second click on `#41` shows `list` again until the refresh lands, and `$RPC` grows.

## Gotchas

- The URL changes as soon as you click, before `ensure` or `fetch` finish: check what's on screen (`$PAGE`), not `location.pathname`.
- TanStack Start: the router reruns a revisited route's loader before showing it (`defaultStaleReloadMode: "blocking"`, `defaultPreloadStaleTime: 0`). Without that it would show the route's last loader data and rerun the loader behind it, and `fetch` would never wait.
- React Router: loaders run on the server for every navigation, each in a new request registry, so `ensure` never finds a result and waits every time, like `fetch`. **ensure waits once** doesn't hold there: the second click on `#41` shows `list` again until `<path>.data` lands. The data comes in `.data` responses, so `$RPC` doesn't grow under any verb; count `performance.getEntriesByType("resource").filter(e => new URL(e.name).pathname.endsWith(".data")).length` instead.
- React Router: an `ensure` or `fetch` page's first HTML still has skeletons for sections whose data was ready: React outlines finished sections once the shell passes 12.8 KB (see [server rendering](server-rendering.md)). The content follows in the same response, so assert on when the response starts, as in **First HTML**.
- Next.js: every navigation renders the page's server components on the server, each in a new request registry, so `ensure` waits every time, as on React Router, and **ensure waits once** doesn't hold. The data comes in the page's server component payload (requests with an `_rsc` search parameter), so `$RPC` grows only with `Load more` pages; count `performance.getEntriesByType("resource").filter(e => new URL(e.name).searchParams.has("_rsc")).length` instead. **First HTML** has as many skeletons under `ensure` as under `prefetch`; at `-b db-latency=3000` the response starts after about 0.01 s for `prefetch`, 4 s for `ensure` and 2 s for `fetch`.
- A missing issue is not a 404 under any verb: `ensure` and `fetch` settle with the `IssueNotFound` failure and the page's boundary shows it (see [error boundaries](error-boundaries.md)).
- Scrolling far down the list can load its next page; those row skeletons belong to the list, not to the next page.
