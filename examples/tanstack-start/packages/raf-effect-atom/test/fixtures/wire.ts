import * as Hydration from "effect/reactivity/Hydration";

/**
 * Sends dehydrated state across a wire, as a framework's serializer would:
 * values cross as copies, and promises resolve to copies.
 */
export const wire = (
	state: ReadonlyArray<Hydration.DehydratedAtom>,
): Array<Hydration.DehydratedAtom> =>
	Hydration.toValues(state).map((entry) => {
		const sent: Hydration.DehydratedAtomValue = {
			...entry,
			resultPromise: entry.resultPromise?.then((value) =>
				structuredClone(value),
			),
			value: structuredClone(entry.value),
		};
		return sent;
	});
