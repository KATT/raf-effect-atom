import type { IssueNotFound, Unauthorized } from "@examples/contract";
import { Match, Option } from "effect";
import { AsyncResult } from "effect/reactivity";
import type { RpcClientError } from "effect/rpc";

import { ErrorNotice } from "./controls.tsx";

/** What reading an issue, its assignee or its comments can fail with. */
type IssueError = IssueNotFound | RpcClientError.RpcClientError | Unauthorized;

/**
 * A failed issue read, rendered by the component that read it: one notice
 * per tag the procedures declare, and one for a defect, whose error is
 * `unknown`.
 */
export function IssueFailure<A>(props: {
	readonly caughtBy: string;
	readonly failure: AsyncResult.Failure<A, IssueError>;
}) {
	const caughtBy = props.caughtBy;
	return Option.match(AsyncResult.error(props.failure), {
		onNone: () => (
			<ErrorNotice caughtBy={caughtBy} type="unknown">
				The server died while handling the request.
			</ErrorNotice>
		),
		onSome: (error) =>
			Match.valueTags(error, {
				IssueNotFound: (notFound) => (
					<ErrorNotice caughtBy={caughtBy} type="IssueNotFound">
						There’s no issue #{notFound.id}.
					</ErrorNotice>
				),
				RpcClientError: () => (
					<ErrorNotice caughtBy={caughtBy} type="RpcClientError">
						The request didn’t reach the server.
					</ErrorNotice>
				),
				Unauthorized: () => (
					<ErrorNotice caughtBy={caughtBy} type="Unauthorized">
						You’re signed out.
					</ErrorNotice>
				),
			}),
	});
}
