import { Effect } from "effect";
import { Atom } from "effect/reactivity";

import type { DemoDefinition } from "~/demo-kit/define.ts";

const modules = import.meta.glob<{ default: DemoDefinition }>([
	"./*.tsx",
	"!./*.test.tsx",
]);

/**
 * A demo's code, loaded on demand. Each page's loader prefetches the demos
 * it embeds next to the page itself, so they download in parallel instead
 * of after the page renders. Demos run only in the browser, so the atom
 * isn't serializable.
 */
function makeDemoAtom(id: string) {
	return Atom.make(
		Effect.promise(async () => {
			const load = modules[`./${id}.tsx`];
			if (!load) {
				throw new Error(`Unknown demo "${id}"`);
			}
			const module = await load();
			return module.default;
		}),
	).pipe(Atom.keepAlive, Atom.withLabel(`demo:${id}`));
}

export const demoAtom = Atom.family(makeDemoAtom);
