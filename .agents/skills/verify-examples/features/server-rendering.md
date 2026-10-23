# Server rendering

Every page arrives with its data in the HTML: the route's loader starts the page's atoms in a per-request registry, the shell streams first, and each section's result streams in after it as its atom settles. The browser hydrates those results into its registry and doesn't call the same procedures again.

## Sub-features

- `ssr-list` the status counts and the first page of rows are in the HTML of `/prefetch/issues`.
- `ssr-detail` the title, description, status, assignee and first page of comments are in the HTML of `/prefetch/issues/<id>`.
- `ssr-stream` sections the server hasn't loaded yet stream as skeletons first, then as content in the same response.
- `ssr-no-refetch` hydrating doesn't call `/rpc` for what the server sent.
- `ssr-rpc` `POST /rpc` answers the contract's procedures with JSON, typed failures included.

## How to get to it (user POV)

- Open any URL directly (address bar, reload, or a shared link). Client-side navigations call `/rpc` from the browser instead.

## Driving it with control-examples

Preconditions:

- Baseline state. Latency 400 ms (the default), so the stream has something to wait for.
- Issue `#3` is untouched: title `Notification email loses input on refresh`, 2 comments.

React puts `<!-- -->` between text parts, so strip those before grepping.

- **List HTML.** `curl -sL $U/issues | sed 's/<!-- -->//g' > /tmp/list.html; grep -o 'Change status' /tmp/list.html | wc -l; grep -o 'Showing [0-9]* of [0-9]* issues' /tmp/list.html`. `10` (one status menu per row) and `Showing 10 of 42 issues`. `grep -o 'AtomRpc:[A-Za-z]*' /tmp/list.html | sort -u` lists `AtomRpc:CountIssues` and `AtomRpc:ListIssues`: the dehydrated atoms.
- **Detail HTML.** `curl -s $U/prefetch/issues/3 | sed 's/<!-- -->//g' > /tmp/detail.html; grep -o 'value="Notification email loses input on refresh"' /tmp/detail.html | wc -l; grep -o '>Assignee<' /tmp/detail.html | wc -l; grep -o '[0-9]* comments\?<' /tmp/detail.html | head -1`. `1`, `1`, then `2 comments<`.
- **Streaming.** `grep -b -o -e animate-pulse -e 'Opened Jan' /tmp/detail.html | awk -F: '!seen[$2]++'`. Two lines, `<offset>:animate-pulse` first: the skeletons are earlier in the response than the issue's data.
- **No refetch on hydrate.** `$CE open $U/prefetch/issues/3`, then `$CE eval 'performance.getEntriesByType("resource").filter(e => new URL(e.name).pathname.startsWith("/rpc")).length'`. `0`. To see that the filter catches data requests, click `Issues` in the header and run it again: the list's calls show up.
- **RPC endpoint.** `curl -s -X POST $U/rpc -H 'content-type: application/json' -b db-latency=0 -d '{"_tag":"Request","id":"1","tag":"GetIssue","payload":{"id":999},"headers":[]}'`. One `Exit` whose `cause` is a `Fail` with `{"_tag":"IssueNotFound","id":999}`. With `"id":3` the exit is a `Success` with the issue.

## Gotchas

- `/issues` redirects to `/prefetch/issues`, which adds `?sort=newest&status=all`; use `curl -L`.
- The browser posts to `/rpc/`, with a trailing slash. Match with `startsWith("/rpc")`: an exact `=== "/rpc"` never fires and passes for the wrong reason.
- A typed failure the page claims (signed out, missing issue) is thrown during server rendering, so the HTML has the shell and the boundary renders in the browser. The production server logs `Error in renderToReadableStream` with the error; that's expected. Check what the boundary shows with `$CE text`, not with `curl` (see [error boundaries](error-boundaries.md)).
- The list page makes one `/rpc` call after hydrating: rows 11-20, because the `Load more` button is within 300 px of the viewport at the helper's 1280×900 window (see [issue list](issue-list.md)). Count on the issue page, or scroll to the top first.
- `head -c` on the response is not a streaming check: the document head (styles and scripts) is larger than any small byte window. Compare offsets as above.
- A slow first compile after a dev-server start can make the first `curl` take 10-20 s. That's not streaming.
