import type { ComponentType } from "react";

/** What a `www/src/demos/<id>.tsx` module exports as its default. */
export interface DemoDefinition {
	readonly Component: ComponentType;
	readonly title: string;
}
