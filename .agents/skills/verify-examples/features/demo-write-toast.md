# Demo write warning

On a deployed demo, every write (title, description, status, comment) shows a warning toast, `Edits may not stick on this demo`: the db is in memory, and on Vercel the next request can reach a different function instance with its own seed. Locally it doesn't show.

## Sub-features

- `toast-deployed` on any host but `localhost`, `127.0.0.1`, `[::1]` or `*.local`, a write shows the toast for 8 s.
- `toast-single` repeated writes refresh the one toast instead of stacking.
- `toast-preview` `sessionStorage["raf-effect-atom-mock-db-toast"] = "1"` shows it locally.

## How to get to it (user POV)

- Make any edit on the deployed app.

## Driving it with control-examples

Preconditions:

- Baseline state, Latency `0 ms`.

Commands:

- **Preview locally.** `$CE open $U/prefetch/issues/3; $CE eval 'sessionStorage.setItem("raf-effect-atom-mock-db-toast", "1")'`, change the status (see [status changes](status-changes.md)), `$CE wait --text 'Edits may not stick on this demo'`. Put the status back.
- **None locally.** Without the flag (`$CE eval 'sessionStorage.clear()'`), the same write shows no toast: `$CE wait --text 'Edits may not stick' --timeout 2000` times out.

## Gotchas

- On the deployed app a reload after a write can show the old value, for the same reason the toast gives. Prove writes locally; on the deployment, check reads and the toast.
