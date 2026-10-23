# Issue detail

`/<verb>/issues/<id>` shows one issue: its title and description (both editable in place, see [inline editing](inline-editing.md)), its status menu, the date it was opened, its comments, and an assignee card. Each part has its own skeleton while its result streams in.

## Sub-features

- `detail-page` the title, `#<id>`, status, `Opened <date>` and description.
- `detail-skeletons` under `prefetch`, a click on a row opens the page at once onto skeletons; the id is shown right away, from the URL.
- `detail-assignee` an `Assignee` card with the assignee's name, title and initials.
- `detail-back` the header's `Issues` link goes back to the list, under the same verb.

## How to get to it (user POV)

- Click a row in the [issue list](issue-list.md), or open `/prefetch/issues/<id>` directly.

## Driving it with control-examples

Preconditions:

- Baseline state. Issue `#3` is untouched (Open, assigned to Linus Torvalds, 2 comments).

Commands:

- **Page.** `$CE open $U/prefetch/issues/3; $CE snapshot`. `textbox "Title"`, `textbox "Description"`, `button "Status: Open. Change status"`, `heading "2 comments"`. `$CE text | grep -E '^(#3|Opened Jan 11|Assignee|Linus Torvalds|Kernel maintainer)$'` prints all five.
- **Skeletons.** Set Latency to `3 s` (`$CE select --name Latency --value 3000`), `$CE open $U/prefetch/issues`, click `#41` (`$CE click --role link --name '/^#41 /'`), and right away `$CE eval 'document.querySelectorAll(".animate-pulse").length > 0 && location.pathname'`: `"/prefetch/issues/41"`. Then `$CE wait --text Opened --timeout 15000`. `Reset settings` afterwards.
- **Back.** `$CE click --role link --name Issues --exact; $CE wait --text Showing; $CE eval location.pathname`. `"/prefetch/issues"`.

## Gotchas

- The title and description are form fields, so they're in `$CE snapshot` as textboxes and their text is the field's value: `$CE text` doesn't print them, `$CE wait --text` does see them.
- There are no previous/next links in this app.
