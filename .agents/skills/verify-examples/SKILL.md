---
name: verify-examples
description: Launch and drive the raf-effect-atom example issue tracker in headless Chrome and with curl, the way a user does, and prove a change works there. Use when a change touches an example app, examples/.shared/, or packages/ behavior the examples show.
---

# Verify the example apps

The example apps are one issue tracker on several stacks, so one feature map ([`features/README.md`](features/README.md)) covers all of them. A change to one app is proven in that app; a change to `examples/.shared/` or `packages/` is proven in every app.

| App              | Start                                        | Port | Data layer                                       |
| ---------------- | -------------------------------------------- | ---- | ------------------------------------------------ |
| `tanstack-start` | `pnpm --filter @examples/tanstack-start dev` | 3005 | Effect RPC at `POST /rpc`, in-process during SSR |
| `react-router`   | `pnpm --filter @examples/react-router dev`   | 3006 | Effect RPC at `POST /rpc`, in-process during SSR |

Add a row (and an `apps` entry in the helper) when an app lands.

The helper below is `CE`:

```bash
CE="node .agents/skills/verify-examples/scripts/control-examples.mjs"
```

## Launch

Node comes from `.nvmrc` (24). Dependencies: `pnpm install` at the root.

Start each app in its own tmux session (`example-<app>`) from the repo root and leave it running:

```bash
tmux -f /exec-daemon/tmux.portal.conf new-session -d -s example-tanstack-start -c "$PWD" -- bash -l
tmux -f /exec-daemon/tmux.portal.conf send-keys -t example-tanstack-start:0.0 'pnpm --filter @examples/tanstack-start dev' C-m
```

No env vars, no database: data is an in-memory mock seeded when the server process starts.

Ready means `curl -sL localhost:<port>/issues` returns issue rows (`Change status` is in the HTML). `/issues` redirects to `/prefetch/issues` (TanStack Start: 307, then a second redirect that adds `?sort=newest&status=all`; React Router: 302, no search); follow redirects. The first request after a start compiles routes and can take 10-20 s.

To check a production build instead of dev: `pnpm --filter @examples/<app> build && pnpm --filter @examples/<app> start`, same port. The build is what Vercel deploys and has no dev-only console noise.

Then start the browser:

```bash
$CE chrome start   # headless Chrome, DevTools on :9333, profile in /tmp/verify-examples
```

## Doctor

```bash
$CE doctor                        # Chrome + every app
$CE doctor --app tanstack-start   # Chrome + one app
```

Each line is `ok` or `FAIL` with the reason. Drive nothing until the apps you need are `ok`. If an app is `FAIL` and you didn't start it, start it as in Launch; don't drive a port someone else's process owns without checking its tmux session first (`tmux -f /exec-daemon/tmux.portal.conf ls`).

## Drive

`$CE` with no arguments prints the full command list. The ones recipes use:

- `$CE open <url>`: navigate, wait for load and network idle, print the URL, title, and any console errors or exceptions during load. An exception here is a finding, except the ones a feature's `Gotchas` names. `--color-scheme dark|light` emulates the OS theme for that load and prints the page's theme class and `color-scheme`.
- `$CE snapshot`: visible headings and controls as `role "accessible name" [state]`. Start here to find handles.
- `$CE click --role <role> --name <name>`: real mouse events at the element's center. `--name` is a case-insensitive substring; `--exact` for an exact match, `--nth <i>` for the i-th, `'/regex/'` for a pattern (`'/^Open \d+$/'`).
- `$CE hover --role <role> --name <name>`: move the mouse onto an element (link prefetch on intent).
- `$CE fill --role textbox --name <name> --value <v>`: click, select all, type.
- `$CE select --name <label> --value <value or label>`: choose an option of a native `<select>`.
- `$CE press Enter|Escape|Tab|ArrowDown|...`
- `$CE scroll bottom|top|<px>`: mouse-wheel scrolling; `bottom` keeps going while an infinite list grows.
- `$CE wait --text <t>` / `--gone <t>` / `--role <r> --name <n>` / `--eval <expr>`, with `--timeout <ms>` (default 10 s). Text includes what's typed in inputs. Wait on something; never sleep blindly before asserting.
- `$CE text`, `$CE eval '<expression>'`, `$CE screenshot --path <file>` (`--width 390` for a phone's layout).

Server-rendered HTML and the RPC endpoint are checked with `curl` (see [server-rendering](features/server-rendering.md)). Persistence is checked by reloading the page (`$CE open` again): the server's in-memory db is the only store.

The feature files give the exact recipe per feature. One Chrome page is shared by every command, so drive one app at a time.

## Evidence

Write artifacts under `/opt/cursor/artifacts/verify-examples/<app>/<feature>/` (or `/tmp/verify-examples/artifacts/` outside a cloud agent):

- The action and the end state: the `$CE` commands you ran with their output, plus `$CE snapshot` and `$CE screenshot` after the action.
- For a write: a second read that doesn't go through the page's registry, a fresh `$CE open` of the page.
- For server rendering: the `curl` output, grepped for the data.

Proof standards: drive the user path (clicks, typing), not `fetch` calls or React internals from `eval`. `eval` is for reading state after the user path ran. A change to shared code is unproven until each app has run its recipe; say which ones did.

## Deployed apps

Each app's production deployment is on Vercel ([`.agent-docs/decisions/vercel-projects.md`](../../../.agent-docs/decisions/vercel-projects.md) has the projects and hostnames). The `curl` recipes run unchanged against `U=https://<hostname>`; there, writes show the [demo write warning](features/demo-write-toast.md).

## Cleanup

```bash
$CE chrome stop
```

This stops only the Chrome the helper started and deletes its profile. Stop dev servers you started by killing their tmux session (`tmux -f /exec-daemon/tmux.portal.conf kill-session -t example-<app>`), never by process name. Leave servers you didn't start running. Restarting a server reseeds its data, which undoes every write. Evidence stays where you wrote it.

## Helpers

[`scripts/control-examples.mjs`](scripts/control-examples.mjs): a dependency-free DevTools protocol client (Node 22+). Chrome comes from `CHROME_PATH` or `google-chrome`; `VERIFY_EXAMPLES_CDP_PORT` (default 9333) and `VERIFY_EXAMPLES_DIR` (default `/tmp/verify-examples`) move it.

## Keeping the map honest

When a change adds, removes, or renames something a user sees in the examples (a route, a control's accessible name, a setting, a message), update the matching feature file in the same commit. When the apps stop matching, either fix the app or record the difference in that feature's `Gotchas` with the reason.
