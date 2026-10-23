import type { ComponentType } from "react";

export interface DemoDefinition {
	/**
	 * The demo, rendered in its own registry. Its atoms reach the demo's
	 * worker through `IssuesClient`.
	 */
	readonly Component: ComponentType;
	/** One sentence on what to try. */
	readonly hint: string;
	readonly title: string;
}

export function defineDemo(demo: DemoDefinition): DemoDefinition {
	return demo;
}
