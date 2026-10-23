# Theme

The app follows the system's light or dark setting, with no flash of the wrong theme on load.

## Sub-features

- `theme-system` `prefers-color-scheme: dark` puts `class="dark"` on `<html>` and a dark background.
- `theme-light` the light scheme puts `class="light"` on `<html>`.

## How to get to it (user POV)

- Change the OS or browser theme.

## Driving it with control-examples

Preconditions:

- None.

Commands:

- **Dark.** `$CE open $U/prefetch/issues --color-scheme dark`. Prints `<html class="dark">, color-scheme dark` and a dark `oklch` body background.
- **Light.** `$CE open $U/prefetch/issues --color-scheme light`. Prints `<html class="light">, color-scheme light` and a white background.

## Gotchas

- There's no theme toggle; the system decides.
