# Code follows Effect's own idioms (human asked)

Human: copy code patterns from the Effect codebase; model services, layers, errors, Schemas, RPC handlers, tests and naming on how Effect itself does them, and don't invent a house style. `.repos/effect` is the source of truth, over memory and over earlier decisions here. Before writing a kind of Effect code for the first time, find how Effect writes it and copy that:

- `LLMS.md` and `ai-docs/src/**` (the walkthroughs `LLMS.md` links): services, layers, errors, Schema, tests.
- `ai-docs/src/51_http-server/fixtures/**`: a contract kept apart from its server (`api/` vs `server/`), middleware that provides `CurrentUser`, an in-memory service layer.
- `packages/platform/node/test/fixtures/rpc-schemas.ts` and `rpc-e2e.ts`, `packages/platform/node/test/RpcServer.test.ts`: RPC groups, middleware, `toLayer` handlers, clients, and tests over HTTP.

The rules below are what those files do. Where this file and `.repos/effect` disagree, `.repos/effect` wins; fix this file.

## Functions

- Inline Effect code is `Effect.gen`. A reusable function is `Effect.fn("Name.method")` when a span helps, `Effect.fnUntraced` when it doesn't (library internals, hot paths). No functions that only wrap and return `Effect.gen`.
- Combinators on an `Effect.fn` go in as extra arguments, never `.pipe` on the result.
- Failing: `return yield* new IssueNotFound({ id })` inside the generator. No `flatMap(x ? succeed : fail)` ternaries.
- Inside a generator: `const issues = yield* Issues`, then `yield* issues.list(input)`. Never `yield* Issues.use(...)` (in `.repos/effect`, `const x = yield* Service` outnumbers `yield* X.use(` by about 50 to 1). `Service.use(f)` only as a whole expression outside a generator: one-call atom effects, `runPromise(Service.use(...))` at a framework edge, shared constants.
- A step shared by several Effects is an Effect value, not a copy.
- Time is `DateTime` and `Clock` (`DateTime.now`), never `Date` or `Date.now`, so `TestClock` controls it. Parsing is a Schema (`Schema.decodeUnknownOption(...)`), never a hand-written predicate; runtime type checks use `Predicate`.

## Services and layers

- A service is `class Issues extends Context.Service<Issues, { ...interface }>()("<package>/<dir>/Issues") {}`: the interface written out as the second type parameter, and a key of the package name plus the path to the file.
- Implementations are static layers on the class, built with `Layer.effect(Issues, Effect.gen(...))`, returning `Issues.of({ ... })` with each method an `Effect.fn("Issues.method")`. Names: `layer` is the one production uses, fully provided; `layerNoDeps` is the same before its dependencies are provided; `layerTest` (or `layerMemory`) is the test or in-memory variant. Compose with `Layer.provide`, or `Layer.provideMerge` when the caller also needs the dependency.
- A value with a default (a setting, a per-request override) is `Context.Reference<T>("<package>/<Name>", { defaultValue })`.
- Config is read inside the layer with `Config.*` (`Config.Number("DB_LATENCY_MS").pipe(Config.withDefault(400))`); a layer picked by config is `Layer.unwrap`.

## Schemas and errors

- Domain models are `Schema.Class<Issue>("<package>/Issue")({ ... })`; ids are branded (`Schema.Int.pipe(Schema.brand("IssueId"))`). One-off shapes (payload fields, inputs) are `Schema.Struct` or field records.
- Errors are `Schema.TaggedError<IssueNotFound>()("IssueNotFound", { ... })`, one class per failure, with the fields a handler needs. Not `Data.TaggedError`; there's no `TaggedErrorClass` in 4.0.
- Dates in a Schema are `Schema.DateTimeUtc` (its JSON codec is an ISO string).

## RPC

- The group, its Schemas, its errors and its middleware _declarations_ live in the client-safe contract ([contract-split.md](./contract-split.md)), like `ai-docs`' `api/` folder. Middleware is `RpcMiddleware.Service<Authorization, { provides: CurrentUser }>()("<package>/Authorization", { error: Unauthorized })`.
- Implementations live in the backend, like `ai-docs`' `server/` folder: middleware as `Layer.succeed(Authorization)(Authorization.of(...))` or `Layer.effect`, handlers as `IssueRpcs.toLayer(Effect.gen(function* () { const issues = yield* Issues; return IssueRpcs.of({ ... }) }))`.
- Handlers are thin arrows that delegate to a service (`GetIssue: ({ id }) => issues.get(id)`). `RpcServer` already opens a span per request (`RpcServer.<Procedure>`), so handlers don't add `Effect.fn` spans of their own; the service methods carry the domain spans.
- A per-request concern the client never sees (latency, timing) is a middleware declared on the group without `requiredForClient`, as Effect's `TimingMiddleware` fixture is.

## Tests

- `@effect/vitest`: `it.effect` with `assert` (`assert.strictEqual`, `assert.deepStrictEqual`, `assert.instanceOf`), `Effect.flip` to get at a failure, `TestClock.adjust` for time, `Effect.forkChild` plus `Fiber.join` for work that sleeps.
- Each test provides its layer with `.pipe(Effect.provide(X.layerTest))` so it starts fresh; `layer(X.layerTest)("name", (it) => ...)` only when the tests are meant to share state.
- RPC is tested end to end over HTTP the way `RpcServer.test.ts` does: `HttpRouter.serve(route)` on `NodeHttpServer.layerTest`, and a real `RpcClient` over `RpcClient.layerProtocolHttp`, so errors cross the JSON wire. `RpcTest.makeClient` (no serialization) is for unit tests of handler logic only.

## Files

- An Effect module (a namespace, service, Layer or Schema) is named after what it exports, in PascalCase like Effect's own (`Issues.ts`, `IssueErrors.ts`, `IssueRpcs.ts`, `Authorization.ts`), with its test beside it (`Issues.test.ts`). Every other file is kebab-case (`use-atom-result.ts`, `internal/failed-reads.ts`). Lint enforces both ([file-names.md](./file-names.md)). Framework files keep the framework's names (routes, `vite.config.ts`).
