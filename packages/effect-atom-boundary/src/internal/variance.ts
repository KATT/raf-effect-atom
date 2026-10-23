import type { TypeId, Variance } from "../claim.ts";

/** @internal */
export const variance: Variance<never>[TypeId] = {
	_Tags: (_: never) => _,
};
