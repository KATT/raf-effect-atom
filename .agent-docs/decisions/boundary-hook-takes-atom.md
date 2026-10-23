# A boundary's hook takes the atom (human asked)

- **Call site:** `useAtomResult(useIssueBoundary(issue), props.issue)`, or `useIssueBoundary(issue(id))` for one atom. The hook checks its boundary is mounted and returns the wrapped atom or family, typed `UseErrorBoundary<Tags>` (the old `Wrap<Tags>` overloads). It replaces `useIssueBoundary().wrap(...)` from [boundary-wrap-read-api.md](./boundary-wrap-read-api.md); the wrapping itself is unchanged.
- **Why:** `wrap` was the only thing components used. The claims object's `owns` only served the parent chain, now internal, and `ErrorBoundaryClaims` is gone from the API.
- **Cost:** it's a hook, so it can't be called conditionally or in a callback. A component that reads an atom only on some renders passes the family unconditionally and calls it where it needs the atom.
- `AtomErrorBoundary.claim` stays: it's static, not a hook, and claims every failure.
