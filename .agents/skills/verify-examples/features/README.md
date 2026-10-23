# Example apps feature map

Behavior-level inventory of the example issue tracker, from a user's point of view. The apps show the same screens with the same accessible names, so every recipe runs unchanged against each, with `$U` set to the app's origin. Where an app differs, the feature's `Gotchas` says so and why.

## Baseline preconditions

- The app is running from this checkout and `$CE doctor --app <app>` is `ok` (see [`../SKILL.md`](../SKILL.md)).
- `CE="node .agents/skills/verify-examples/scripts/control-examples.mjs"` and `U=http://localhost:3005` (`tanstack-start`), `U=http://localhost:3006` (`react-router`) or `U=http://localhost:3007` (`nextjs`).
- Seed data: 42 issues, `#1` (oldest, Jan 7) to `#42` (newest), each Open, In progress or Closed (17, 16, 9), with 0-10 comments and an assignee. Ten issues per page, four comments per page. Data lives in the server process: a restart reseeds, and each app has its own copy.
- Settings cookies are at their defaults (Prefetch links Off, Latency 400 ms, Session Signed in). `Reset settings` restores them.

## Driving conventions

- Recipes open `$U/<verb>/issues…` with a [loader verb](loader-verb.md) (`prefetch` unless the recipe is about the verb). `/issues…` without a verb redirects to the same page under `/prefetch/`.
- Find elements by role and accessible name (`$CE snapshot`), never by CSS class or position.
- Wait for text with `$CE wait`, not fixed sleeps. The server adds about 400 ms ± 50% per procedure call by default; set Latency to `0 ms` for fast runs, or `3 s` to watch pending states.
- `$CE open` the same URL twice after starting a dev server: Vite compiles on first visit and may reload the page once.
- Writes go to the server's in-memory db. Put back what you changed (title, description, status) at the end of a recipe. Comments can't be deleted; post them on an issue nobody else asserts on, or restart the server.
- Read writes back with a fresh `$CE open`: a new page starts with an empty registry and loads from the server.

## Proof and skip reporting

- Record the action and the observable end state: command output, `$CE snapshot`, a screenshot when the look matters.
- A write is proven by a reload.
- A change to `examples/.shared/` or `packages/` is proven in every app. Name the apps you ran; one app passing doesn't prove the others.
- If a path can't be reached, say which and why, and cover the closest real path (a production build).

## Feature entry contract

Each feature file starts with an H1 and a paragraph on what the user sees, then four H2s in this order: `Sub-features` (short IDs, one line each), `How to get to it (user POV)`, `Driving it with control-examples` (`Preconditions:` then labelled bullets pairing an action, the exact command, and the observable result), and `Gotchas`. Keep implementation details out: user paths, accessible names, URLs, commands, and what proves it.

## Full sweep

Walk the list top to bottom for a broad regression.

- [Server rendering](server-rendering.md): data in the first HTML, streamed sections, hydration without refetching, the RPC endpoint.
- [Issue list](issue-list.md): counts, status filter, sort, infinite scroll, row links.
- [Issue detail](issue-detail.md): the issue page, skeletons, assignee card.
- [Status changes](status-changes.md): the status menu in list rows and on the issue page.
- [Inline editing](inline-editing.md): edit the title and description in place, cancel, the server's validation.
- [Comments](comments.md): paged comments, posting with a pending row, the server's validation.
- [Settings bar](settings-bar.md): loader verb, link prefetch, latency, session, Reset.
- [Loader verb](loader-verb.md): `prefetch`, `ensure` or `fetch` from the URL and the `Loader` select, and what each waits for.
- [Error boundaries](error-boundaries.md): signed out, missing issues and unknown URLs.
- [Navigation progress bar](navigation-progress.md): the bar along the top while a navigation waits.
- [Demo write warning](demo-write-toast.md): the toast deployed demos show on writes.
- [Theme](theme.md): light and dark follow the system.
