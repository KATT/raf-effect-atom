# Comments

An issue page lists its comments four at a time, oldest first, under a `<n> comments` heading, with a composer at the top. Posting shows the new comment at once as pending, then as saved.

## Sub-features

- `comments-list` author, date and text per comment; the heading counts them all.
- `comments-paging` scrolling near the end loads the next four.
- `comments-post` `textbox "Add a comment"` and `button "Comment"`: the comment shows by `You` while it saves, then the heading's count goes up.
- `comments-validation` an empty comment shows `Comment can't be empty` and posts nothing.

## How to get to it (user POV)

- Any issue page, below the description.

## Driving it with control-examples

Preconditions:

- Baseline state, Latency `0 ms`. Post on an issue no other recipe counts comments on, such as `#40` (1 comment).

Commands:

- **List.** `$CE open $U/prefetch/issues/3; $CE snapshot | grep heading`. `heading "2 comments"`; `$CE text` shows `Linus Torvalds` twice with their texts.
- **Paging.** `$CE open $U/prefetch/issues/38; $CE scroll bottom; $CE wait --eval 'document.querySelectorAll("main li").length === 10'`. `#38` has `heading "10 comments"`, loaded four at a time.
- **Post.** `$CE open $U/prefetch/issues/40; $CE fill --role textbox --name 'Add a comment' --value 'Checked on staging too.'; $CE click --role button --name Comment --exact; $CE wait --text '2 comments'`. Then `$CE open $U/prefetch/issues/40; $CE wait --text 'Checked on staging too.'`: it's saved.
- **Validation.** `$CE click --role button --name Comment --exact` with an empty box; `$CE wait --text "Comment can't be empty"`. The count doesn't change.

## Gotchas

- Comments can't be deleted. Each post stays until the server restarts.
- With Latency at `3 s` the pending comment, by `You`, is visible for a few seconds before the count changes.
