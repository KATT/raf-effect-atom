import { CaughtError } from "@examples/kit/components/issue-page";
import { Cause, Option } from "effect";
import type { AsyncResult } from "effect/reactivity";
import type { RpcClientError } from "effect/rpc/RpcClientError";

/**
 * The one typed failure left once the boundaries above claim theirs: the
 * request didn't reach the server or its answer didn't decode. A defect
 * isn't a typed failure: the read throws it to the app's error boundary.
 */
export function LoadFailed(props: {
	readonly result: AsyncResult.Failure<unknown, RpcClientError>;
}) {
	const error = Option.getOrThrow(Cause.findErrorOption(props.result.cause));
	return (
		<CaughtError boundary="the component" tag="RpcClientError">
			{error.message}
		</CaughtError>
	);
}
