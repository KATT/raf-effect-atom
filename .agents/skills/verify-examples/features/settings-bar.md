# Settings bar

The header has four selects and a Reset button for trying the app under different conditions, each select under a small label. The first, `Loader`, is the URL's verb (see [loader verb](loader-verb.md)). The others live in cookies (`link-prefetch`, `db-latency`, `session`), so server rendering uses them too. Under the selects a line names the current verb and what it waits for.

## Sub-features

- `settings-prefetch` `Prefetch links`: `Off`, `On intent`, `In viewport`, `On render`. With anything but Off, in-app links run the next page's loader before the click.
- `settings-latency` `Latency`: `0 ms`, `100 ms`, `400 ms`, `1 s`, `3 s`. Each procedure call waits about that long (±50%), on the server and from the browser.
- `settings-session` `Session`: `Signed in`, `Signed out`. Signed out, every procedure fails with `Unauthorized` and the page shows the [auth boundary](error-boundaries.md). Changing it reloads the page.
- `settings-reset` the icon button `Reset settings` clears the three cookies, then reloads with the defaults (Off, 400 ms, Signed in).

## How to get to it (user POV)

- The header of every page.

## Driving it with control-examples

Preconditions:

- Baseline state.

Count data requests with this expression (`$RPC`):

```bash
RPC='performance.getEntriesByType("resource").filter(e => new URL(e.name).pathname.startsWith("/rpc")).length'
```

Commands:

- **Options.** `$CE open $U/prefetch/issues; $CE snapshot | grep combobox` shows `Loader [value=prefetch]`, `Prefetch links [value=off]`, `Latency [value=400]`, `Session [value=signed-in]`.
- **Latency on the server.** `curl -s -o /dev/null -w '%{time_total}\n' -b db-latency=0 $U/ensure/issues/3` is well under a second; with `-b db-latency=3000` it's over 2 s (`ensure` waits for the issue before the page streams).
- **Latency cookie.** `$CE select --name Latency --value '0 ms'; $CE eval document.cookie`. Contains `db-latency=0`.
- **Session.** `$CE select --name Session --value 'Signed out'`, wait for the reload, `$CE text | grep 'signed out'`: `You're signed out, so the server refuses every request.` `$CE click --role button --name 'Sign in'` reloads signed in. `curl -s -b session=signed-out …/rpc` (the request from [server rendering](server-rendering.md)) fails with `Unauthorized`.
- **Prefetch on intent.** `$CE select --name 'Prefetch links' --value 'On intent'; $CE open $U/prefetch/issues/3; $CE eval "$RPC"` (a baseline), `$CE hover --role link --name Issues --exact`, wait a second, `$CE eval "$RPC"`: 2 more, the list's counts and first page ran on hover. Clicking then adds only the second page's call (rows 11-20, see [issue list](issue-list.md)): the click reuses what the hover loaded.
- **Prefetch on render.** `$CE select --name 'Prefetch links' --value 'On render'; $CE open $U/prefetch/issues/3`, wait a second, `$CE eval "$RPC"`: the list's calls ran without any hover.
- **Reset.** `$CE click --role button --name 'Reset settings'`, wait for the reload (the URL, and so the verb, stays), `$CE snapshot | grep combobox` shows the defaults again and `$CE eval document.cookie` is `""`.

## Gotchas

- All procedures share one path, `POST /rpc`, so compare how many calls there are rather than which.
- `$CE select --value` takes the option's value (`3000`, `signed-out`) or its label (`3 s`, `Signed out`).
- A server restart doesn't clear cookies; Reset does. Reset doesn't touch the db: edits stay until the server restarts.
- `$CE screenshot --width 390` shows the phone layout. Nothing in the header scrolls sideways at 360 px.
