"use client";

import * as AsyncResult from "effect/reactivity/AsyncResult";
import { type Handle, useAtomResult } from "raf-effect-atom";

import { comments } from "./atoms.ts";

export function Comments(props: { readonly handle: Handle<typeof comments> }) {
	const result = useAtomResult(comments, props.handle);
	return AsyncResult.isSuccess(result)
		? result.value.map((comment) => <p key={comment}>{comment}</p>)
		: null;
}
