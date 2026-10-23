# Test cleanup with `using` (human in raf-query, kept)

- Tests undo what they set up with `using`, not `onTestFinished` (lint: `no-restricted-imports`) or lifecycle hooks (`vitest/no-hooks`). A helper that sets something up returns a `Disposable` that undoes it. Vitest spies are already disposable:

  ```ts
  it("logs the caught failure once", () => {
  	using errors = vi.spyOn(console, "error");
  	render();
  	expect(errors).toHaveBeenCalledOnce();
  });
  ```

- Unused bindings take a `_` prefix (`no-unused-vars` ignores `^_`): `using _timers = fakeTimers();`.
- The packages' `lib` includes `ESNext.Disposable` for the types, since their tsconfig covers tests and source alike. Library code still targets ES2024, so it must not use `using` or `Symbol.dispose`.
