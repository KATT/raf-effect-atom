# Code follows Effect's own idioms (human asked)

- `.repos/effect` is the source of truth for Effect patterns (`LLMS.md`, `ai-docs/src`), over memory and over earlier decisions here.
- Reusable Effect functions are `Effect.fn("name")`, with combinators as extra arguments, never `.pipe` on the result. Loaders, actions and RPC handlers all follow this; handler spans are named `<Group>.<Procedure>`.
- Failing: `return yield* new IssueNotFound(...)` inside the generator. No `flatMap(x ? succeed : fail)` ternaries.
- Inside a generator: `const issues = yield* Issues`, then `yield* issues.UpdateTitle(input)`. Never `yield* Issues.use(...)` (in `.repos/effect`, `const x = yield* Service` outnumbers `yield* X.use(` by about 50 to 1).
- `Service.use(f)` only as a whole expression outside a generator: one-call atom effects, `runPromise(Service.use(...))` at a framework edge, shared constants.
- A step shared by several Effects is an Effect value, not a copy.
