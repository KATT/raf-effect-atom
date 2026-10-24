# A boundary's hook takes the read's result (human asked)

- **Call site:** `useIssueBoundary(useAtomResult(issue, props.issue))`. The hook checks its boundary is mounted, throws a failure whose tag this boundary or a parent claims as the error itself, throws a defect, and returns the rest typed `UnclaimedResult<R, Tags>`: a failure with no error left drops out of the union, so a fully claimed read is `Success<A, never>`.
- **Why:** it reads inside out, read then narrow, and takes any `AsyncResult`, so it works over `useAtomResult`, `useAtomValue` or `useAtomSuspense` with `includeFailure`. No derived atom, no memo, no `initialValueTarget` pointer, and no failed-reads record: `reset` already finds failures by scanning the registry.
- **No dependency between the packages,** as before: the hook only sees an `AsyncResult`.
- **`AtomErrorBoundary.claim` is gone:** `useAtomSuspense` without `includeFailure` already throws every failure as the error. `AtomErrorBoundary` catches an error only if it's the object its atom's failure holds in the boundary's registry (`Prerender.peek`), so a failure another atom's read threw still goes to the boundaries above.
- **Costs accepted:**
  - A read that throws every failure itself (`useAtomSuspense` without `includeFailure`) throws before the hook sees it.
  - Two atoms that fail with one shared error object look the same to `AtomErrorBoundary`'s check.
- **Rejected:**
  - `useIssueBoundary(issue, handle)`, the boundary doing the read: `effect-atom-boundary` would depend on `raf-effect-atom`'s handles and loaders, and couldn't narrow Effect Atom's own hooks.
  - `useAtomResult(issue, handle, IssueBoundary)`: the reverse dependency, or a shared contract, and Effect Atom's hooks need another path.
  - Wrapping the atom, `useAtomResult(useIssueBoundary(issue), handle)`: a claimed failure became a defect in a derived atom, and a read only some renders make had to pass the family.
