# Gap audit: what Effect Atom already does, and the thin layers this repo adds (agent, human scope)

Human scope: "just thin layers on top of effect atom + effect rpc". The public API is typed error boundaries (`effect-atom-boundary`) and starting atoms from route loaders with a verb per call, streamed into the client (`raf-effect-atom`), for TanStack Start / Router, Next.js and React Router. Everything else is Effect Atom, Effect RPC and the frameworks, and the docs say so with examples.

Read against `effect` / `@effect/atom-react` 4.0.6 (`.repos/effect`). Every "Atom already does it" example below typechecked against those versions (scratch project, `tsc` on TypeScript 7.0.2); the boundary type sketch did too, including the `@ts-expect-error` cases.

## Builds on `AtomRpc`, not plain atoms over an `RpcClient` service

Decision: the examples, samples and demos build their query and mutation atoms with [`AtomRpc.Service`](../../.repos/effect/packages/effect/src/reactivity/AtomRpc.ts), and `raf-effect-atom` accepts any `Atom<AsyncResult<A, E>>`, so it doesn't depend on `AtomRpc` either.

Why `AtomRpc`:

- `query(tag, payload, options)` is already an `Atom.family` keyed by `{ tag, payload, headers, reactivityKeys, timeToLive, serializationKey }`, and families compare keys with `Equal` (structural for plain objects). A loader and a component that call `IssuesClient.query("GetIssue", { id })` get the same atom with no key bookkeeping.
- With `serializationKey`, the atom is `Atom.serializable` under `AtomRpc:<tag>:<key>` with `AsyncResult.Schema({ success: rpc.successSchema, error: Union(rpc.errorSchema, middleware errors, RpcClientError) })`. `AsyncResult.Schema` encodes a failure as `Schema.Cause(error, Defect)`, so a server-side `IssueNotFound` hydrates as an `IssueNotFound` instance. That is the "typed failures survive server rendering" requirement, without raf-query's `keepErrors` adapter.
- The atom's type carries the procedure's error union (`_Error | RpcClientError | middleware errors`), which is what boundaries infer `catchTags` from.
- `reactivityKeys` on queries and mutations is invalidation, `timeToLive` is per-query cache lifetime, `mutation(tag)` is an `AtomResultFn`, and stream RPCs become `Atom.pull` atoms.

Rejected: plain `runtime.atom(client.GetIssue(payload))` over an `RpcClient` service. It would re-implement the family keying, the serializable schema (including the middleware and `RpcClientError` members of the union) and reactivity, for one gain: control over hydration options. That gain is covered below without leaving `AtomRpc`.

What `AtomRpc` lacks, and how this repo covers it:

- **Hydrated atoms run again on mount.** `AtomRpc` never sets `skipInitialRun`, and Atom's default is that "a seeded effect or stream atom still runs its effect on mount". So every RPC result the server rendered is requested again by the browser. `raf-effect-atom` sets it: the loader verbs and the read hook use `hydrated(atom)`, which returns a memoized copy whose `Serializable` metadata has `skipInitialRun: true` (the `Serializable` interface is public, so this needs no internals and no group). Worth an upstream issue: an `AtomRpc.query` option.
- **`serializationKey` is opt-in per call.** Without it the atom never hydrates and the browser fetches it again. On the server, the verbs fail fast in development when a loader starts a non-serializable atom. The examples pass the payload's id (`serializationKey: String(id)`).
- **Stream RPCs (`Atom.pull`) aren't serializable**, so they don't hydrate. Out of scope: infinite lists start in the browser, as `Atom.pull` already does.

## Every raf-query docs page, sorted

"Atom" = Effect Atom already does it (example below). "Adds" = `raf-effect-atom` or `effect-atom-boundary` adds it (API below). "n/a" = doesn't apply to Atom. "Docs" = a docs-site page about this project, not a feature.

| raf-query page                 | Group       | How                                                                                                                                                                              |
| ------------------------------ | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| api-reference                  | Docs        | Reference for the two packages' small APIs.                                                                                                                                      |
| background-fetching-indicators | Atom        | `AsyncResult`'s `waiting` flag on the atom; navigations use the router's pending state. A global `useIsFetching` is n/a.                                                         |
| caching                        | Atom        | The registry is the cache: idle TTL (`RegistryProvider`'s `defaultIdleTTL`, `Atom.setIdleTTL`, `keepAlive`, `AtomRpc`'s `timeToLive`), staleness with `Atom.swr({ staleTime })`. |
| client-state                   | Atom        | Writable atoms (`Atom.make(value)`), `Atom.family`, `Atom.kvs`.                                                                                                                  |
| comparison                     | Docs        | Becomes "what's Atom, what's this" (this table).                                                                                                                                 |
| credits                        | Docs        | Credits result-rpc ([credit-result-rpc.md](./credit-result-rpc.md)), Effect, raf-query.                                                                                          |
| devtools                       | n/a         | Atom 4 ships no devtools. `www`'s demo kit gets an atoms panel built on `registry.getNodes()` / `subscribe`; it isn't a published API.                                           |
| effect                         | Atom        | Atoms are Effects: `Atom.runtime(layer).atom(effect)`; the registry is a service (`AtomRegistry.AtomRegistry`).                                                                  |
| effect-errors                  | Atom + Adds | Errors are typed in `AsyncResult`; catching them in React by tag is the boundary package.                                                                                        |
| effect-services                | Atom        | `Atom.runtime(layer)` per registry, `Atom.context({ memoMap })` to share layers; RPC headers per call.                                                                           |
| examples                       | Docs        | Three apps, one issue tracker ([example-apps.md](./example-apps.md)).                                                                                                            |
| handles                        | n/a         | Atoms are the handles: the loader and the component derive the same atom from the route params. A loader-typed handle (raf-query's "typed by what the loader did") isn't ported. |
| important-defaults             | Docs        | Atom's defaults (idle TTL 400 ms in React, no retries, no focus refetch unless asked) plus this library's server rules (per-request registry, no revalidation on the server).    |
| infinite-queries               | Atom        | `Atom.pull`, stream RPCs in `AtomRpc.query`. Browser-only (not serializable).                                                                                                    |
| installation                   | Docs        | Peers: `effect`, `@effect/atom-react`, `react`.                                                                                                                                  |
| mutations                      | Atom        | `IssuesClient.mutation("RenameIssue")` with `reactivityKeys`; `Atom.optimistic` / `optimisticFn`; forms are TanStack Form in the examples.                                       |
| overview                       | Docs        | Pitch: Atom is the cache; these packages add loaders, streaming and typed boundaries.                                                                                            |
| polling                        | Atom        | `Atom.withRefresh(atom, duration)`.                                                                                                                                              |
| query-cancellation             | Atom        | Unmounted atoms are interrupted after their idle TTL; the RPC client sends `Interrupt`; `Atom.Interrupt` for `fn` atoms.                                                         |
| query-factories                | Atom        | `Atom.family`; `AtomRpc.query` is one.                                                                                                                                           |
| query-functions                | Atom        | The atom's Effect is the query function. Redirects: a loader reads `ensure`'s result and calls the framework's redirect.                                                         |
| query-invalidation             | Atom        | `registry.refresh(atom)`, `useAtomRefresh`, `Reactivity` keys on queries and mutations. Invalidation on the server is n/a (a registry per request).                              |
| query-keys                     | Atom + Adds | Atom identity, structural family keys. Adds: the development check that loader-started atoms are serializable on the server.                                                     |
| query-meta                     | n/a         | `Atom.withLabel` is the only metadata; no filtering by meta.                                                                                                                     |
| quick-start                    | Docs        | Contract, `AtomRpc` client, loader verb, read hook, boundary.                                                                                                                    |
| react-router                   | Adds        | `raf-effect-atom/react-router`.                                                                                                                                                  |
| react-server-components        | Adds        | `raf-effect-atom/next`.                                                                                                                                                          |
| reading-queries                | Atom + Adds | `useAtomValue`, `useAtomSuspense`, `useAtomRefresh`. Adds: the read hook that waits for a streamed result instead of fetching again, and claims errors for boundaries.           |
| render-optimizations           | Atom        | Fine-grained atoms, `Atom.map`, `withEquality`. Structural sharing is n/a.                                                                                                       |
| request-waterfalls             | Adds        | The loader verbs. raf-query's `useWaterfall` is n/a.                                                                                                                             |
| retries                        | Atom + Adds | Retry in the atom's Effect (`Effect.retry(schedule)`) or RPC client middleware. "One place for every error" is the boundary package.                                             |
| ssr-and-hydration              | Atom + Adds | `Hydration.dehydrate` / `hydrate`, `HydrationBoundary`. Adds: the per-request registry, streaming pending atoms as promises, no refetch after hydration.                         |
| starting-queries               | Adds        | `prefetch` / `ensure` / `fetch`, below.                                                                                                                                          |
| tanstack-start                 | Adds        | `raf-effect-atom/tanstack-router`.                                                                                                                                               |
| testing                        | Atom        | `AtomRegistry.make()` per test, `initialValues`, `AtomRegistry.getResult`; `RpcTest.makeClient` or a test protocol layer for the RPC side.                                       |
| url-state-and-pagination       | Atom        | `Atom.searchParam`, family per page, `Atom.withFallback` to keep the previous page while the next loads.                                                                         |
| window-focus-refetching        | Atom        | `Atom.refreshOnWindowFocus`; `Atom.makeRefreshOnSignal(signal)` for other platforms.                                                                                             |

### Atom already does it: the examples

The contract and client every example uses. The contract lives in the client-safe contract package ([contract-split.md](./contract-split.md)):

```ts
import { Layer, Schema } from "effect";
import { FetchHttpClient } from "effect/http";
import { AtomRpc } from "effect/reactivity";
import { Rpc, RpcClient, RpcGroup, RpcSerialization } from "effect/rpc";

export class IssueNotFound extends Schema.TaggedError<IssueNotFound>()(
	"IssueNotFound",
	{ id: Schema.Int },
) {}
export class Unauthorized extends Schema.TaggedError<Unauthorized>()(
	"Unauthorized",
	{},
) {}

const Issue = Schema.Struct({ id: Schema.Int, title: Schema.String });

export class IssueRpcs extends RpcGroup.make(
	Rpc.make("GetIssue", {
		payload: { id: Schema.Int },
		success: Issue,
		error: Schema.Union([IssueNotFound, Unauthorized]),
	}),
	Rpc.make("RenameIssue", {
		payload: { id: Schema.Int, title: Schema.String },
		success: Issue,
		error: IssueNotFound,
	}),
) {}

export class IssuesClient extends AtomRpc.Service<IssuesClient>()(
	"IssuesClient",
	{
		group: IssueRpcs,
		protocol: RpcClient.layerProtocolHttp({ url: "/rpc" }).pipe(
			Layer.provide([FetchHttpClient.layer, RpcSerialization.layerJson]),
		),
	},
) {}
```

Caching, identity, invalidation keys, hydration key, and the error type the boundaries infer:

```ts
export const issue = (id: number) =>
	IssuesClient.query(
		"GetIssue",
		{ id },
		{
			reactivityKeys: { issue: [id] },
			serializationKey: String(id),
			timeToLive: "5 minutes",
		},
	);

// "IssueNotFound" | "Unauthorized" | "RpcClientError"
type IssueErrorTag = Atom.Failure<ReturnType<typeof issue>>["_tag"];
```

Mutations, polling, focus refetching, stale-while-revalidate, families, URL state:

```ts
export const rename = IssuesClient.mutation("RenameIssue");
const run = useAtomSet(rename);
run({ payload: { id: 1, title: "New" }, reactivityKeys: { issue: [1] } });

export const polled = Atom.withRefresh(issue(1), Duration.seconds(10));
export const focused = Atom.refreshOnWindowFocus(issue(1));
export const swr = Atom.swr(issue(1), { staleTime: "30 seconds" });
export const draft = Atom.family((id: number) =>
	Atom.make("").pipe(Atom.keepAlive),
);
export const page = Atom.searchParam("page", {
	schema: Schema.NumberFromString,
});
```

Services in atoms, and the registry outside React (tests, scripts):

```ts
const runtime = Atom.runtime(Layer.succeed(Clock, { now: Effect.succeed(0) }));
export const now = runtime.atom(
	Effect.gen(function* () {
		const clock = yield* Clock;
		return yield* clock.now;
	}),
);

export const program = Effect.gen(function* () {
	const registry = AtomRegistry.make();
	const release = registry.mount(issue(1));
	const result = yield* AtomRegistry.getResult(registry, issue(1));
	registry.refresh(issue(1));
	const state = Hydration.dehydrate(registry, { encodeInitialAs: "promise" });
	release();
	return { result, state };
});
```

Caveat for the docs: `Atom.swr` returns its input's type without `Serializable`, so apply `swr` to atoms that start in the browser, not to loader-started ones.

## `effect-atom-boundary`: typed error boundaries

Ported from raf-query #227 (`.experimental/atom/package/src/error-boundary.tsx`), with one change the human asked for: **boundaries infer their errors.** `catchTags` keys and handler types come from the atom's error type and match on `_tag`. UI code never imports an error class or anything else from the backend; #227's `claims: [IssueNotFound]` (classes) becomes `catchTags: { IssueNotFound: … }` (tags of the atom's own type). The idea is result-rpc's ([credit-result-rpc.md](./credit-result-rpc.md)); the README and docs page credit it.

One boundary for one atom (raf-query #223's shape):

```tsx
<AtomErrorBoundary
	atom={issue(id)}
	catchTags={{
		IssueNotFound: ({ error, reset }) => (
			<NotFound id={error.id} onRetry={reset} />
		),
	}}
>
	<IssuePage id={id} />
</AtomErrorBoundary>
```

Shared, chained boundaries (#222 / #227's shape). `errors` is only for the type: an atom, an atom family, or an `AtomRpc` client (the union of its procedures' errors). Reading through the boundary removes its tags from the result's error type:

```tsx
const [AuthBoundary, useAuthBoundary] = createErrorBoundary({
	name: "Auth",
	errors: IssuesClient,
	catchTags: { Unauthorized: ({ reset }) => <SignIn onSignedIn={reset} /> },
});

function IssueTitle(props: { readonly id: number }) {
	const result = useAtomResult(useAuthBoundary().wrap(issue(props.id)));
	// result's error: IssueNotFound | RpcClientError (Unauthorized is claimed)
	return <Title result={result} />;
}
```

- **Type requirement, tested:** a `catchTags` key that isn't one of the atom's tags is a compile error (on `AtomErrorBoundary` through the object literal's excess-property check; on `createErrorBoundary` through a `const` type parameter whose extra keys map to `never`); a handler's `error` is `Extract<E, { _tag: K }>`; a boundary's `wrap(atom)` is typed `AsyncResult<A, Exclude<E, { _tag: claimed }>>`. The package ships a type test (`*.test-d.ts` / `expectTypeOf`) whose UI file imports only the `AtomRpc` client and the atoms, never an error class, with `@ts-expect-error` on a misspelled tag and a wrong field. The sketch above typechecked, including those cases.
- **Runtime:** `Cause.findErrorOption` on the failure, then `Predicate.isTagged(error, tag)` for each claimed tag, nearest boundary first. A defect or interruption throws `Cause.squash` to an ordinary React error boundary, as #227 does.
- **Claiming is a wrapper atom** (superseded the `claim(atom, registry, result, boundary)` primitive and the claims argument, see [boundary-wrap-read-api.md](./boundary-wrap-read-api.md)): `wrap(atom)` turns a claimed failure into a defect, recorded in #227's `failedReads` WeakMap with its atom and registry so `reset` can refresh that atom. The packages don't depend on each other.
- **Reset** refreshes the failed atom and clears the boundary; while the atom refreshes, the read suspends instead of throwing the old error again (#227's `waiting` check).
- **Known issue, pinned by a test:** an intermittent duplicate request after a boundary catches a failed first load (#222 / #223). The test counts RPC calls through client middleware: first load fails (1 call), reset (exactly 1 more), and no further calls across re-renders and StrictMode.

## `raf-effect-atom`: starting atoms from loaders

### Verbs (decided)

The verbs keep raf-query's names: `prefetch`, `ensure`, `fetch`. Effect-flavoured alternatives were rejected: `mount` / `get` / `refresh` are already `AtomRegistry` methods with different meanings (none of them hands an atom over to the render), and `fork` / `await` describe fibers, not the cache. raf-query's semantics carry over, restated for Atom, where "stale" means the atom already has a value:

| Verb       | Starts the atom                          | Waits                                        | Has a value already            | Returns (Promise / Effect)                     |
| ---------- | ---------------------------------------- | -------------------------------------------- | ------------------------------ | ---------------------------------------------- |
| `prefetch` | yes, if it isn't in the registry         | never                                        | leaves it alone                | `void`                                         |
| `ensure`   | yes, if it isn't in the registry         | only while the atom is `Initial`             | returns it at once, no refetch | the settled `AsyncResult` (Success or Failure) |
| `fetch`    | yes, or `refresh`es it if it has a value | until the new result settles (not `waiting`) | refreshes, then waits          | the settled `AsyncResult`                      |

- Every verb takes a **lease**: `registry.mount(atom)`, released when a component mounts the atom (the read hook takes over) or after a lease TTL (30 s default), so the 400 ms idle TTL can't evict a loader's atom before its route renders.
- Typed failures **don't reject**: `ensure` and `fetch` return the `AsyncResult`, so a loader can `redirect` / `notFound` on a tag with `AsyncResult.match`, and otherwise the failure renders through a boundary. Only defects reject.
- **On the server** every request has its own registry, so `ensure` waits like `fetch` and nothing revalidates in the background. Server-only code (Next.js server components, React Router server loaders) uses `prefetch` to stream and `ensure` to block.
- The core is Effect (`Loader.prefetch(atom): Effect<void, never, AtomRegistry>` and so on); the integrations expose the same verbs as Promises on the router context, because loaders are async functions.

```ts
export const Route = createFileRoute("/issues/$id")({
	loader: async ({ context, params }) => {
		context.atoms.prefetch(comments(params.id));
		const result = await context.atoms.ensure(issue(params.id));
		if (AsyncResult.isFailure(result)) {
			// Failures render through the route's boundary; a loader may redirect instead.
		}
	},
});
```

### Streaming and hydration

- **Per-request registry on the server.** `@effect/atom-react`'s default `RegistryContext` is one module-level registry, which would share data between users. Each integration creates a registry per request (`AtomRegistry.make`) and provides it through `RegistryContext`; the read hook throws in development during server rendering when no `raf-effect-atom` provider is above it.
- **Dehydrate with `encodeInitialAs: "promise"`.** Atoms that settled cross as values; atoms still `Initial` cross as promises that resolve when they settle, carried by each framework's own streaming (TanStack Router's dehydrated state, React's RSC promise props, React Router's Single Fetch).
- **Hydrate without fetching again.** The read hook (a) suspends on a streamed promise for that atom's key instead of mounting it (an `Initial` seed always runs its effect, so mounting early would request it twice), and (b) reads through `hydrated(atom)` so the settled value skips the first run. `raf-effect-atom`'s `HydrationBoundary` wraps `Hydration.hydrate` and records the pending keys per registry for the hook.
- **Typed failures survive** because `AtomRpc`'s schema encodes the `Cause`; the integration test renders an `IssueNotFound` on the server and checks the browser catches an `IssueNotFound` instance through its boundary, with one RPC call in total.

### Integrations (subpath exports, no extra packages)

- **`raf-effect-atom/tanstack-router`** (TanStack Start and Router): `setupRouterAtoms(router)` puts the request's registry and verbs on the router context, wraps the app in the registry and hydration providers (`Wrap`), and dehydrates through the router's `dehydrate` / `hydrate` options. Static prerendering of `www` uses it too.
- **`raf-effect-atom/next`** (App Router): `getRegistry()` per request through React's `cache`, `prefetch` / `ensure` in server components, and a client `HydrateAtoms` that receives `dehydrate(registry)` as props (React serializes the pending promises).
- **`raf-effect-atom/react-router`** (Framework Mode, after the other two): a root `middleware` creates the request's registry in the router context; loaders call the verbs and return `dehydrate(registry)`; the route component wraps its tree in `HydrationBoundary`. raf-query's integration has the same shape and imports nothing from `react-router`, so it adds no peer.

### The read hook

`useAtomResult(atom)` from `raf-effect-atom`: waits for a streamed result, reads with `useAtomSuspense(atom, { includeFailure: true })` through `hydrated(atom)`, releases the loader's lease, returns typed failures and throws defects. For a derived atom (a boundary's `wrap`) it does all of that on the atom its `initialValueTarget` points at. See [boundary-wrap-read-api.md](./boundary-wrap-read-api.md).

## Examples and docs this implies

- The issue tracker in `examples/tanstack-start`, then `examples/nextjs`, then `examples/react-router`; forms with TanStack Form; UI from `@examples/ui` ([shared-ui.md](./shared-ui.md)).
- `www` keeps rich live demos backed by a real `RpcServer` in a Web Worker per demo (`RpcServer.layerProtocolWorkerRunner`, `RpcClient.layerProtocolWorker`), for **both** packages: each boundary feature (per-atom, chained, reset, the duplicate-request case) labels the catching boundary and the error type, with a Twoslash block showing the compile error for a misspelled tag; each verb (`prefetch` vs `ensure` vs `fetch`, streaming, hydration without refetch) shows its requests in the Queries panel, with latency and `failNext` injection from the demo kit.
