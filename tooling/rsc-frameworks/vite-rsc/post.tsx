"use client";

import * as AsyncResult from "effect/reactivity/AsyncResult";
import { type LoadedHandle, useAtomResult } from "raf-effect-atom";

import { post } from "./atoms.ts";

export function Post(props: { readonly handle: LoadedHandle<typeof post> }) {
	const result = useAtomResult(post, props.handle);
	return AsyncResult.isSuccess(result) ? <h1>{result.value.title}</h1> : null;
}
