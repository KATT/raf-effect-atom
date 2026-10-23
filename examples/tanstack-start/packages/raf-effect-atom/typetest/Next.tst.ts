import * as Atom from "effect/reactivity/Atom";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type * as EffectHydration from "effect/reactivity/Hydration";
import { describe, expect, it } from "tstyche";

import type { Loader } from "../src/index.ts";
import * as Next from "../src/Next.ts";
import { issue } from "../test/fixtures/issues.ts";

type IssueError = Atom.Failure<ReturnType<typeof issue>>;
type Issue = Atom.Success<ReturnType<typeof issue>>;

describe("raf-effect-atom/next", () => {
	it("gives server components the verbs, typed by the atom", () => {
		expect(Next.prefetch(issue(1))).type.toBe<void>();
		expect(Next.ensure(issue(1))).type.toBe<
			Promise<Loader.SettledResult<Issue, IssueError>>
		>();
		expect(Next.fetch(issue(1))).type.toBe<
			Promise<Loader.SettledResult<Issue, IssueError>>
		>();
		expect(Next.ensure).type.not.toBeCallableWith(Atom.make(1));
	});

	it("returns the request's registry and its dehydrated state", () => {
		expect(Next.getRegistry()).type.toBe<AtomRegistry.AtomRegistry>();
		expect(Next.dehydrate()).type.toBe<Array<EffectHydration.DehydratedAtom>>();
	});
});
