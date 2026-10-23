import type { ComponentType } from "react";

export interface DemoDefinition {
	/**
	 * The demo, rendered in its own registry. Its atoms reach the demo's
	 * worker through `IssuesClient`.
	 */
	readonly Component: ComponentType;
	/**
	 * The demo's own settings, such as the failures it can queue, shown in the
	 * header next to the latency, above the demo. Rendered in the demo's
	 * registry, so it shares state with `Component` through atoms.
	 */
	readonly Controls?: ComponentType;
	/** One sentence on what to try. */
	readonly hint: string;
	readonly title: string;
}

export function defineDemo(demo: DemoDefinition): DemoDefinition {
	return demo;
}
