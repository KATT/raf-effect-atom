import * as Atom from "effect/reactivity/Atom";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { describe, expect, it } from "tstyche";

import { type Handle, type LoadedHandle, Loader } from "../src/index.ts";
import * as Rsc from "../src/Rsc.ts";
import { issue } from "../test/fixtures/issues.ts";

describe("raf-effect-atom/rsc", () => {
	it("gives server components the verbs, returning handles", () => {
		expect(Rsc.prefetch(issue, 1)).type.toBe<Handle<typeof issue>>();
		expect(Rsc.prefetchInBrowser(issue, 1)).type.toBe<Handle<typeof issue>>();
		expect(Rsc.ensure(issue, 1)).type.toBe<
			Promise<LoadedHandle<typeof issue>>
		>();
		expect(Rsc.fetch(issue, 1)).type.toBe<
			Promise<LoadedHandle<typeof issue>>
		>();
		expect(Rsc.ensure).type.not.toBeCallableWith(Atom.make(1));
		expect(Rsc.run(Loader.ensure(issue, 1))).type.toBe<
			Promise<LoadedHandle<typeof issue>>
		>();
	});

	it("returns the request's registry", () => {
		expect(Rsc.getRegistry()).type.toBe<AtomRegistry.AtomRegistry>();
	});

	it("makes the verbs over a seeded registry, async seeds included", () => {
		const atoms = Rsc.makeRequestAtoms({
			seed: async (registry) => {
				expect(registry).type.toBe<AtomRegistry.AtomRegistry>();
			},
		});
		expect(atoms.prefetch(issue, 1)).type.toBe<Handle<typeof issue>>();
		expect(atoms).type.toBe<Rsc.RequestAtoms>();
	});
});
