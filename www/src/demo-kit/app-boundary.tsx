import { Button } from "@examples/ui/components/button";
import { Predicate } from "effect";
import { type CatchTagProps, createErrorBoundary } from "effect-atom-boundary";
import type { RpcClientError } from "effect/rpc";
import { RotateCcw } from "lucide-react";
import { Component, createContext, type ReactNode, useContext } from "react";

import { IssuesClient } from "./client.ts";
import { ErrorNotice } from "./controls.tsx";

/** Starts the demo over: a new registry, and with it a new worker. */
export const StartOverContext = createContext(() => {});

/**
 * The demo's fallback for what no boundary in it caught: a defect, or a
 * typed error nothing claimed. Its type here is `unknown`.
 */
interface UncaughtState {
	/** What was thrown: anything, which is why its type is `unknown`. */
	readonly caught: { readonly thrown: unknown } | undefined;
}

class Uncaught extends Component<
	{ readonly children: ReactNode; readonly onStartOver: () => void },
	UncaughtState
> {
	override state: UncaughtState = { caught: undefined };

	// oxlint-disable-next-line anti-slop/no-unknown-parameters -- React passes whatever was thrown
	static getDerivedStateFromError(thrown: unknown): UncaughtState {
		return { caught: { thrown } };
	}

	override render() {
		const caught = this.state.caught;
		if (caught === undefined) {
			return this.props.children;
		}
		const error = caught.thrown;
		return (
			<ErrorNotice
				action={
					<Button onClick={this.props.onStartOver} size="xs" variant="outline">
						<RotateCcw /> Start over
					</Button>
				}
				caughtBy="the app's error boundary"
				type="unknown"
			>
				{Predicate.hasProperty(error, "message")
					? String(error.message)
					: String(error)}
			</ErrorNotice>
		);
	}
}

/**
 * The app's error boundary, as the demo's app has it: it catches what no
 * boundary below it claimed, typed `unknown`, and offers to start over. The
 * frame puts one around every demo; a demo puts its own around the part
 * that can fail, to keep its diagrams in view.
 */
export function AppErrorBoundary(props: { readonly children: ReactNode }) {
	const startOver = useContext(StartOverContext);
	return <Uncaught onStartOver={startOver}>{props.children}</Uncaught>;
}

function Unreachable(props: CatchTagProps<RpcClientError.RpcClientError>) {
	return (
		<ErrorNotice
			action={
				<Button onClick={props.reset} size="xs" variant="outline">
					Try again
				</Button>
			}
			caughtBy="<AppBoundary>"
			type="RpcClientError"
		>
			Can’t reach the server.
		</ErrorNotice>
	);
}

/**
 * The boundary around the demo's app, under its error boundary: it claims
 * `RpcClientError`, which every procedure fails with when the request
 * doesn't reach the server.
 */
export const [AppBoundary] = createErrorBoundary({
	catchTags: { RpcClientError: Unreachable },
	errors: IssuesClient,
	name: "App",
});
