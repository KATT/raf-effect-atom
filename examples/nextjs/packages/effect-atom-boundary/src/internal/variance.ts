import type { TypeId, Variance } from "../Claim.ts";

/** @internal */
export const variance: Variance<never>[TypeId] = {
	_Tags: (_: never) => _,
};
