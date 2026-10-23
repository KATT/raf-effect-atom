# Status changes

Every list row and the issue page have a status button that opens a menu of `Open`, `In progress` and `Closed`. Choosing one saves it on the server; the button shows the new status once the save settles, and the counts and lists refresh.

## Sub-features

- `status-menu` `button "Status: <status>. Change status"` opens a menu with three `menuitem`s.
- `status-save` choosing one saves it; a reload shows it.
- `status-refresh` after the save, the status counts and every list page are refreshed.
- `status-error` a failed save shows a toast and leaves the status as it was.

## How to get to it (user POV)

- A row's status badge in the [issue list](issue-list.md), or the badge under the title on an issue page.

## Driving it with control-examples

Preconditions:

- Baseline state. Latency `0 ms` for a quick run (`$CE select --name Latency --value 0`). Issue `#3` is Open.

Commands:

- **Menu.** `$CE open $U/prefetch/issues/3; $CE click --role button --name 'Change status'; $CE snapshot | grep menuitem`. `menuitem "Open"`, `menuitem "In progress"`, `menuitem "Closed"`.
- **Save.** `$CE click --role menuitem --name Closed --exact; $CE wait --role button --name 'Status: Closed'`. Then `$CE open $U/prefetch/issues/3; $CE snapshot | grep 'Change status'`: `Status: Closed`.
- **Counts.** `$CE click --role link --name Issues --exact; $CE wait --text Showing; $CE snapshot | grep -E '^link "(Open|Closed) [0-9]+"'`. `Open 16`, `Closed 10`.
- **Put it back.** On `#3`, choose `Open` again; the counts return to `Open 17`, `Closed 9`.

## Gotchas

- A reload or navigation right after choosing (Session change, Reset) can cancel the save in flight. Wait for the button to show the new status before reloading.
- Status labels are `aria-label`s, not text: wait with `--role button --name 'Status: …'`, not `--text`.
- `status-error` (the `Couldn't change the status` toast) isn't reachable from one tab: signing out reloads into the [auth boundary](error-boundaries.md), which has no status menu. The helper drives a single page, so it's left unproven here.
