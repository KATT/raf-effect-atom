# Navigation progress bar

While a navigation waits on its loader (`ensure` or `fetch` on a cache miss), a thin bar runs along the top of the page. It shows only after 150 ms, so instant navigations don't flash it.

## Sub-features

- `progress-show` `role="progressbar"` named `Loading page` appears while a navigation is pending.
- `progress-hide` it goes away when the new page renders.
- `progress-instant` under `prefetch`, navigations don't wait, so it doesn't show.

## How to get to it (user POV)

- Click a link under `/ensure/` or `/fetch/` with some latency.

## Driving it with control-examples

Preconditions:

- Latency `3 s`.

```bash
BAR='!!document.querySelector("[role=progressbar][aria-label=\"Loading page\"]")'
```

Commands:

- **Shows while waiting.** `$CE open $U/fetch/issues; $CE wait --role link --name '/^#41 /'; $CE click --role link --name '/^#41 /'; $CE wait --eval "$BAR" --timeout 2000`, then `$CE wait --text Opened --timeout 15000; $CE eval "$BAR"`: `false`.
- **Not under prefetch.** The same under `/prefetch/`: `$CE wait --eval "$BAR" --timeout 1000` times out.

## Gotchas

- Reset Latency afterwards (`Reset settings`).
