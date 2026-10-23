import type { DemoDefinition } from "./define.ts";

export function DemoFrame(props: { readonly demo: DemoDefinition }) {
	const Demo = props.demo.Component;
	return (
		<figure className="not-prose my-8 grid gap-3 rounded-xl border bg-card p-4">
			<figcaption className="text-sm font-medium">
				{props.demo.title}
			</figcaption>
			<Demo />
		</figure>
	);
}
