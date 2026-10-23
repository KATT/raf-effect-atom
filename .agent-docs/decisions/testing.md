# Tests (agent, from raf-query)

- React tests render, rerender and click inside **async** `act` (`await act(async () => …)`). A sync `act` (RTL's bare `render`) never resumes a suspended tree after its promise resolves, boundary or not; that's React's behavior (the retry sits on the sync act's dropped queue).
- Effect code is tested with `@effect/vitest`'s `it.effect`; use `TestClock` for time. Effect tests that fork a stream before a write need `Effect.forkChild(x, { startImmediately: true })`.
- Don't unit test the docs site's presentation (human): the build catches broken samples and markdown.
- No module mocking (`workspace/no-mock`, `anti-slop/no-module-mocking`) and no raised timeouts (`workspace/no-custom-test-timeout`): pass a layer or a test RPC server instead (`RpcTest`), and make the test faster.
