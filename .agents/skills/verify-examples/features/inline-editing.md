# Inline editing

On an issue page the title and the description are form fields styled as text. Editing one and leaving it saves it; Escape puts it back. An empty value is refused by the server, and its message shows under the field.

## Sub-features

- `edit-title` `textbox "Title"`: Enter or blur saves, Escape cancels.
- `edit-body` `textbox "Description"`: blur or Cmd/Ctrl+Enter saves, Escape cancels.
- `edit-pending` while a save is in flight the field is disabled and dimmed.
- `edit-validation` an empty title shows `Title can't be empty`, an empty description `Description can't be empty`. Both come from the server's `EmptyTitle` / `EmptyBody` errors.

## How to get to it (user POV)

- Any issue page: click the title or the description.

## Driving it with control-examples

Preconditions:

- Baseline state, Latency `0 ms`. Issue `#3` is untouched: title `Notification email loses input on refresh`.

Commands:

- **Save the title.** `$CE open $U/prefetch/issues/3; $CE fill --role textbox --name Title --value 'Notification email loses input on reload'; $CE press Enter; $CE wait --eval '!document.querySelector("input[name=title]").disabled'`. Then `$CE open $U/prefetch/issues/3; $CE wait --text 'loses input on reload'`: the reload has the new title.
- **Cancel.** `$CE fill --role textbox --name Title --value 'Something else'; $CE press Escape; $CE wait --text 'loses input on reload'`. The field is back to the saved title, and a reload agrees.
- **Validation.** `$CE fill --role textbox --name Title --value ' '; $CE press Enter; $CE wait --text "Title can't be empty"`. The same for the description: `$CE fill --role textbox --name Description --value ' '; $CE press Tab; $CE wait --text "Description can't be empty"`. Escape in each puts the saved text back.
- **Put it back.** Fill the title with `Notification email loses input on refresh` and press Enter.

## Gotchas

- The page's own list and detail results refresh after a save, so the list shows the new title too.
- `$CE text` doesn't print field values; use `$CE wait --text` or `$CE eval 'document.querySelector("input[name=title]").value'`.
