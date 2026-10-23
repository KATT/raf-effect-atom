import * as Atom from "effect/reactivity/Atom";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type * as EffectHydration from "effect/reactivity/Hydration";
import { describe, expect, it } from "tstyche";

import type { Handle, LoadedHandle } from "../src/index.ts";
import * as Next from "../src/Next.ts";
import { issue } from "../test/fixtures/issues.ts";

describe("raf-effect-atom/next", () => {
	it("gives server components the verbs, returning handles", () => {
		expect(Next.prefetch(issue, 1)).type.toBe<Handle<typeof issue>>();
		expect(Next.ensure(issue, 1)).type.toBe<
			Promise<LoadedHandle<typeof issue>>
		>();
		expect(Next.fetch(issue, 1)).type.toBe<
			Promise<LoadedHandle<typeof issue>>
		>();
		expect(Next.ensure).type.not.toBeCallableWith(Atom.make(1));
	});

	it("returns the request's registry and its dehydrated state", () => {
		expect(Next.getRegistry()).type.toBe<AtomRegistry.AtomRegistry>();
		expect(Next.dehydrate()).type.toBe<
			Promise<Array<EffectHydration.DehydratedAtom>>
		>();
	});

	it("makes the verbs over a seeded registry, async seeds included", () => {
		const atoms = Next.makeRequestAtoms({
			seed: async (registry) => {
				expect(registry).type.toBe<AtomRegistry.AtomRegistry>();
			},
		});
		expect(atoms.prefetch(issue, 1)).type.toBe<Handle<typeof issue>>();
		expect(atoms).type.toBe<Next.RequestAtoms>();
	});
});
