import { CaughtError } from "@examples/kit/components/issue-page";
import { Cause, Option } from "effect";
import type { AsyncResult } from "effect/reactivity";
import type { RpcClientError } from "effect/rpc/RpcClientError";

/**
 * What's left once the boundaries above claim their errors: the request
 * didn't reach the server or its answer didn't decode.
 */
export function LoadFailed(props: {
	readonly result: AsyncResult.Failure<unknown, RpcClientError>;
}) {
	const error = Cause.findErrorOption(props.result.cause);
	return (
		<CaughtError boundary="the component" tag="RpcClientError">
			{Option.match(error, {
				onNone: () => "Something went wrong.",
				onSome: (value) => value.message,
			})}
		</CaughtError>
	);
}
