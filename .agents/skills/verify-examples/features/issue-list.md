# Issue list

`/<verb>/issues` lists the issues ten at a time, newest first, under a status filter with a count per status and a sort switch. Scrolling near the end loads the next page. Each row links to its issue and has its own status menu (see [status changes](status-changes.md)).

## Sub-features

- `list-counts` the filter shows `All`, `Open`, `In progress` and `Closed`, each with its count.
- `list-filter` choosing a status shows only issues with that status and puts it in the URL.
- `list-sort` `Newest` / `Oldest` reorders the list and puts the order in the URL.
- `list-infinite` scrolling near the end loads the next ten; `Showing N of M issues` counts what's loaded.
- `list-row-link` a row opens its issue, under the same verb.
- `list-empty` a filter with no issues shows `No issues.`

## How to get to it (user POV)

- Open `/` or `/issues`, or click the `Issues` link in the header from any page.

## Driving it with control-examples

Preconditions:

- Baseline state (seed counts: All 42, Open 17, In progress 16, Closed 9).

Commands:

- **Counts.** `$CE open $U/prefetch/issues; $CE snapshot | grep -E '^link "(All|Open|In progress|Closed) [0-9]+"'`. Four links: `All 42`, `Open 17`, `In progress 16`, `Closed 9`.
- **Filter.** `$CE click --role link --name '/^Open \d+$/'; $CE wait --text 'of 17 issues'; $CE snapshot | grep 'Change status' | sort | uniq -c`. One line, `button "Status: Open. Change status"`: every row is Open. `$CE eval 'location.search'` has `status=open`.
- **Sort.** Then `$CE click --role link --name Oldest --exact; $CE wait --eval 'location.search.includes("sort=oldest")'; $CE wait --role link --name '/^#3 /'; $CE snapshot | grep -m1 '^link "#'`. The first row is `#3 Notification email loses input on refresh … Open` (the oldest Open issue). The URL still has `status=open`.
- **Back to the default.** `$CE click --role link --name '/^All \d+$/'`, then `$CE click --role link --name Newest --exact`. The first row is `#42 Billing export breaks on narrow screens`.
- **Infinite scroll.** `$CE open $U/prefetch/issues; $CE scroll bottom; $CE wait --text 'Showing 42 of 42 issues'; $CE snapshot | grep -c 'button "Load more"'`. Prints `0`: no more pages.
- **Row link.** `$CE click --role link --name '/^#3 /'; $CE wait --text Opened; $CE eval location.pathname`. `"/prefetch/issues/3"`.

## Gotchas

- At the helper's 1280×900 window the `Load more` button is within reach on a fresh load, so the list shows rows 11-20 (`Showing 20 of 42 issues`) before any scrolling. Don't assert `Showing 10 of` in the browser; the server's HTML has it.
- `list-empty` isn't reachable on seed data (every status has issues). To see it, move all nine Closed issues to another status, then put them back.
- Status labels in rows are `aria-label`s, not text, so `$CE wait --text` / `--gone` can't see them. Wait on `Showing … of <total> issues` (each filter has its own total) or with `--eval`.
- Status counts and pages are all refreshed after a status change elsewhere settles (see [status changes](status-changes.md)).
- React Router: `/prefetch/issues` has no search until you pick a filter or a sort; the filter links always carry both (`?sort=newest&status=open`). A search the list can't read (`?status=bogus`) answers 404 with `Nothing here.`
- Next.js: a client navigation changes the URL only once the server's response arrives, and until then the links still carry the old search. A click sent before the last one landed keeps its stale filter: in **Back to the default**, `Newest` clicked right after `All` keeps `status=open`. Wait between them (`$CE wait --eval 'location.search.includes("status=all")'`).
