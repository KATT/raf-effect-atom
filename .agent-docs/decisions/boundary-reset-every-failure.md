# A shared boundary's reset refreshes every failure it handles

- **Scope:**
  - A `createErrorBoundary` boundary's `reset` refreshes every registry node whose settled failure has a tag that boundary has a handler for. The parents' tags aren't included.
  - `AtomErrorBoundary`'s `reset` still refreshes only its own atom, the one whose failure it caught.
- **Why:**
  - One outage, such as an `RpcClientError`, fails every atom on a page.
  - The boundary catches only the first read that throws. The other atoms fail after the handler replaced the children, so they throw to no boundary.
  - Refreshing only the read that threw left the next read to throw its cached failure, which cost one `Try again` per atom.
  - This uses the same registry scan as the server pre-render check ([boundary-server-rendering.md](./boundary-server-rendering.md)).
- **Each query refreshes once:**
  - Refreshing a node marks its dependents waiting, and the scan skips nodes that are waiting.
- **Refresh the node's atom, not the caller's:**
  - Every refresh, here and in `raf-effect-atom`'s `Loader.fetch`, goes through `registry.getNodes().get(key).atom`.
  - Once the garbage collector takes an `Atom.family` member (an AtomRpc query), a read makes it again with the same serialization key but new inner atoms.
  - `registry.refresh(newAtom)` then invalidates an inner atom no node runs, so no request goes out.
- **Rejected:**
  - Accumulating the failed reads per boundary instance: atoms that fail after the children unmount never reach it.
  - Refreshing every failed node in the registry: that would refetch failures this boundary doesn't own.
