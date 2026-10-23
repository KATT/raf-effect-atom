# The RPC contract is a client-safe package; handlers and db are a separate backend (human asked)

Human: split the example backend for safety. A client-safe **contract** package holds the RPC group, its Schemas and the tagged errors, with no server dependencies. A standalone **backend** holds the handlers and the db. Frontends import only the contract. This replaces the brief's single `examples/.shared/api` package that held both. Human, later: each app serves the backend in-process under an HTTP route; there's no separate backend deployment.

The layout copies Effect's own `ai-docs/src/51_http-server/fixtures` (`api/` for the contract, `server/` for the implementations) and its RPC test fixtures; [effect-idioms.md](./effect-idioms.md) has the patterns.

## Packages

- **`examples/.shared/contract`** (`@examples/contract`): depends on `effect` only. Browsers, server rendering, docs samples and the worker demos all import it.
  - `Issue.ts`: the `Schema.Class` models (`Issue`, `User`, `Comment`, `IssuePage`, `CommentPage`, `IssueCounts`), branded ids (`IssueId`, `UserId`, `CommentId`), `IssueStatus`, `Cursor`, and `IssueListInput` (the URL search params).
  - `IssueErrors.ts`: one `Schema.TaggedError` per failure (`IssueNotFound`, `EmptyTitle`, `EmptyBody`, `EmptyComment`).
  - `Authorization.ts`: the `Authorization` middleware declaration (error `Unauthorized`, provides `CurrentUser`) and the session cookie names.
  - `Latency.ts`: the server-only `Latency` middleware declaration (no client part, like Effect's `TimingMiddleware` fixture), the `db-latency` cookie name and its Schema decoder.
  - `IssueRpcs.ts`: the `RpcGroup`, with both middlewares on every procedure.
- **`examples/.shared/db`** (`@examples/db`): the `Issues` service (`Issues.layer` keeps the process-wide tables across dev-server reloads; `Issues.layerTest` seeds fresh ones), the `DbLatency` reference, and the seed. Server-only.
- **`examples/.shared/backend`** (`@examples/backend`): `AuthorizationLayer` and `LatencyLayer` (the middleware implementations), `IssueHandlersNoDeps` (`IssueRpcs.toLayer`, thin arrows over `Issues`), `RpcRoutes` (`RpcServer.layerHttp` at `/rpc`), `webHandler` (`HttpRouter.toWebHandler(RpcRoutes)`), and `pnpm --filter @examples/backend start`, which serves `RpcRoutes` on its own with `@effect/platform-node` (`PORT`, default 3001). Its tests run a real `RpcClient` over HTTP and JSON against `NodeHttpServer.layerTest`.
- **The `AtomRpc` client is per app**, not in the contract: its protocol differs per app (`#rpc-transport`: fetch in the browser, the in-process `webHandler.handler` on the server). Name it `IssuesClient`, after Effect's `UsersClient`.
- Each app serves `webHandler.handler` from one server-only `*.server.ts` module that its RPC route imports (TanStack Start: the `/rpc` server route; Next.js: `app/rpc/route.ts`, which also imports `server-only`; React Router: a resource route), and server rendering calls it in-process through the server variant of `#rpc-transport`, as raf-query's `examples/tanstack-start-effect` does. `*.server.ts` modules are the only frontend files allowed to import `@examples/backend`; every other frontend file imports the contract.
- `@examples/backend` doesn't import `server-only` itself: that package throws outside the `react-server` condition, which would break the backend's tests and its `start` script.

## Why a types-only client import isn't possible (checked in `.repos/effect`, 4.0.6)

The claim holds. `RpcClient` needs the group's runtime value and its Schemas:

- `RpcClient.make(group, …)` takes the group as a value (`packages/effect/src/rpc/RpcClient.ts`, `make`). For each request it looks up `group.requests.get(message.tag)` and builds the payload with `rpc.payloadSchema.make(payload)`.
- `makeRpcSchemas` compiles, per procedure, `encodePayload: Schema.encodeEffect(codecFor(rpc.payloadSchema))` and `decodeExit: Schema.decodeUnknownEffect(codecFor(Rpc.exitSchema(rpc)))`. The exit schema is built from the procedure's success and error Schemas, so decoding is what turns `{ "_tag": "IssueNotFound", "id": 3 }` on the wire back into an `IssueNotFound` instance. Without the Schemas, typed failures would arrive as plain objects (or not decode at all), and the boundaries' `catchTags` types would lie.
- `AtomRpc.Service` passes `options.group` to `RpcClient.make`, and its query atoms' hydration schema is `AsyncResult.Schema({ success: rpc.successSchema, error: Union(rpc.errorSchema, middleware errors, RpcClientError) })`, which needs the same runtime Schemas in the browser.

So the browser bundle must contain the contract, which is why the contract has to be safe to ship, and the handlers have to live elsewhere. result-rpc's [client boundary](https://result-rpc.com/concepts/client-boundary/) page makes the same split between the contract and the router ([credit-result-rpc.md](./credit-result-rpc.md)).

## Keeping handlers and db out of client bundles

Two checks, so a leak fails before it ships.

**Lint: `workspace/no-server-imports`** (`tooling/oxlint-plugins/no-server-imports.ts`, configured in `.oxlintrc.json`). Its own rule rather than oxlint's `no-restricted-imports`, because an override replaces a rule's options wholesale and the root already sets `no-restricted-imports` for test helpers.

- Frontend code (`examples/*/{src,app}/**`, `www/src/**`, `www/samples/*/{src,app}/**`, `examples/.shared/{ui,kit}/**`) may not import `@examples/backend`, `@examples/db`, or any path inside them. Type-only imports are allowed: they're erased.
- `**/*.server.{ts,tsx}` turns the rule off: those are the server-only modules above, which the frameworks keep out of client bundles.
- The contract may not import `node:*`, `@effect/platform-node*`, or any `@examples/*` package, so "client-safe" stays true as it grows. Its `package.json` lists only `effect` (knip reports anything else as unlisted).
- `no-server-imports.test.ts` covers both configurations: subpaths, re-exports, dynamic and side-effect imports fail; type-only imports pass.

**CI bundle check (`tooling/bundle-check`, Effect, run by a `bundle_check` job in `ci.yaml`)**, added with the first example app:

- Generic: `bundle-check <client-dir> --forbid <package>...`. Each app runs it from a `check:bundle` script on its own client output (`.output/public` for TanStack Start, `.next/static` for Next.js, `build/client` for React Router) with `--forbid @examples/db --forbid @examples/backend`. The job builds every example (`pnpm -r --filter "./examples/*" build`), then runs every `check:bundle`.
- Reads the client build's source maps, not its text: a bundler lists a module in a chunk's `sources` when it contributed code, so tree-shaken imports pass and any shipped code fails, with no marker to keep in sync. A source fails when it's under a forbidden workspace package's directory (found with `pnpm ls`) or under `node_modules/<name>/`. Turbopack's `turbopack:///[project]/…` sources match by the package's path from the workspace root.
- Each app builds its client with source maps: `build.sourcemap: "hidden"` in Vite (the chunks don't link to them), `productionBrowserSourceMaps: true` in Next.js. With no maps the check fails rather than passing a build it couldn't read. Chunks with no map (Rolldown's runtime) are listed as unchecked.
- Rejected: grepping chunks for markers such as the db service's key `@examples/db/Issues` and the seed's text. It needs a marker per package, and minifiers can rename or split strings.
- Has its own test: real Vite builds of a fixture, where a client entry that calls the backend fails, one that imports only the contract passes, and one whose backend import is tree-shaken passes.
- Framework guards on top, where they exist: Next.js's `server-only` in `app/rpc/route.ts`, and React Router's and TanStack Start's refusal of `.server.ts` modules in client code.
