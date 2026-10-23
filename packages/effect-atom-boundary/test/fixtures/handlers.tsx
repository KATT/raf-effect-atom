import type * as Atom from "effect/reactivity/Atom";

import type { CatchTagProps } from "../../src/index.ts";
import type { issue } from "./issues.ts";

export type IssueNotFound = Extract<
	Atom.Failure<ReturnType<typeof issue>>,
	{ readonly _tag: "IssueNotFound" }
>;

/**
 * Every test project compiles this file with React Compiler, which memoises
 * this handler with a `useMemoCache` hook, like an app's compiled handler.
 */
export function CompiledNotFound(props: CatchTagProps<IssueNotFound>) {
	return (
		<button onClick={props.reset} type="button">
			{`Compiled: no issue ${props.error.id}`}
		</button>
	);
}
