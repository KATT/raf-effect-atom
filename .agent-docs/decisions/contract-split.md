# The RPC contract is a client-safe package; handlers and db are a separate backend (human asked)

Human: split the example backend for safety. A client-safe **contract** package holds the RPC group, its Schemas and the tagged errors, with no server dependencies. A standalone **backend** holds the handlers and the db. Frontends import only the contract. This replaces the brief's single `examples/.shared/api` package that held both.

## Packages

- **`examples/.shared/contract`** (`@examples/contract`): the `RpcGroup`, payload and success Schemas, `Schema.TaggedError` classes (one error set per procedure), and the `AtomRpc` client service with its protocol coming from the app (`#rpc-transport`). Depends on `effect` only. Browsers, server rendering, docs samples and the worker demos all import it.
- **`examples/.shared/db`** (`@examples/db`): the in-memory issue tracker data and its Effect service. Server-only.
- **`examples/.shared/backend`** (`@examples/backend`): the handlers (`IssuesRpc.toLayer(...)`) over `@examples/db`, `RpcServer.layerHttp` plus `HttpRouter.toWebHandler` as a web handler, and a `start` script that serves it on its own with `@effect/platform-node`, so the backend runs and is tested without any frontend.
- The apps serve the backend's web handler from one server-only module each (TanStack Start: the `/rpc` server route; Next.js: the `app/rpc/route.ts` route handler; React Router: a resource route in a `.server.ts` module), and server rendering calls it in-process through the server variant of `#rpc-transport`, as raf-query's `examples/tanstack-start-effect` does. Those modules are the only frontend files allowed to import `@examples/backend`; every other frontend file imports the contract.

## Why a types-only client import isn't possible (checked in `.repos/effect`, 4.0.6)

The claim holds. `RpcClient` needs the group's runtime value and its Schemas:

- `RpcClient.make(group, …)` takes the group as a value (`packages/effect/src/rpc/RpcClient.ts`, `make`). For each request it looks up `group.requests.get(message.tag)` and builds the payload with `rpc.payloadSchema.make(payload)`.
- `makeRpcSchemas` compiles, per procedure, `encodePayload: Schema.encodeEffect(codecFor(rpc.payloadSchema))` and `decodeExit: Schema.decodeUnknownEffect(codecFor(Rpc.exitSchema(rpc)))`. The exit schema is built from the procedure's success and error Schemas, so decoding is what turns `{ "_tag": "IssueNotFound", "id": 3 }` on the wire back into an `IssueNotFound` instance. Without the Schemas, typed failures would arrive as plain objects (or not decode at all), and the boundaries' `catchTags` types would lie.
- `AtomRpc.Service` passes `options.group` to `RpcClient.make`, and its query atoms' hydration schema is `AsyncResult.Schema({ success: rpc.successSchema, error: Union(rpc.errorSchema, middleware errors, RpcClientError) })`, which needs the same runtime Schemas in the browser.

So the browser bundle must contain the contract, which is why the contract has to be safe to ship, and the handlers have to live elsewhere. result-rpc's [client boundary](https://result-rpc.com/concepts/client-boundary/) page makes the same split between the contract and the router ([credit-result-rpc.md](./credit-result-rpc.md)).

## Keeping handlers and db out of client bundles

Two checks, so a leak fails before it ships.

**Lint (`.oxlintrc.json`, oxlint's built-in `no-restricted-imports`)**, added with the packages:

- Frontend code (`examples/*/{src,app}/**`, `www/src/**`, `www/samples/*/{src,app}/**`, `examples/.shared/{contract,ui,kit}/**`) may not import `@examples/backend`, `@examples/db`, or any path inside them. The message points here.
- An override re-allows `@examples/backend` in exactly the server-only modules listed above (the three RPC routes and the `#rpc-transport` server variants), by path.
- The contract (`examples/.shared/contract/**`) may also not import `node:*`, `@effect/platform-node*`, or other workspace packages, so "client-safe" stays true as it grows. Its `package.json` lists only `effect` (knip reports anything else as unlisted).
- Each restriction gets a test in `tooling/oxlint-plugins` style: a fixture file that violates it and the expected diagnostic, so loosening the config is caught.

**CI bundle check (`tooling/bundle-check`, Effect, run by a `bundle_check` job in `ci.yaml`)**, added with the first example app:

- Builds each app (`pnpm --filter <app> build`) and scans only its client output: `.output/public/**` for the TanStack Start apps and `www`, `.next/static/**` for Next.js, `build/client/**` for React Router.
- Fails when a client chunk contains a server-only marker. `@examples/backend` and `@examples/db` each define a marker string that their code uses at runtime (the backend tags its handler layer's span prefix with it; the db names its service with it), so the marker can't be tree-shaken while the code it belongs to stays. The db's seed records are a second marker.
- Has its own test: a fixture client bundle that imports the backend must fail the check, and one that imports only the contract must pass.
- Framework guards on top, where they exist: `@examples/backend` imports `server-only` (Next.js fails a client import at build time), and the React Router resource route lives in a `.server.ts` module (React Router's Vite plugin refuses it in client code).
