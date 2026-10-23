import { Skeleton } from "@examples/ui/components/skeleton";
import { ClientOnly } from "@tanstack/react-router";
import { Suspense } from "react";

import { DemoFrame } from "~/demo-kit/frame.tsx";
import { demoAtom } from "~/demos/registry.ts";
import { useLoaded } from "~/use-loaded.ts";

function DemoPlaceholder() {
	return (
		<div
			aria-label="Loading demo"
			className="not-prose my-8 grid gap-3 rounded-xl border bg-card p-4"
			role="status"
		>
			<Skeleton className="h-5 w-48" />
			<Skeleton className="h-40 w-full" />
			<Skeleton className="h-16 w-full" />
		</div>
	);
}

function LoadedDemo(props: { readonly id: string }) {
	return <DemoFrame demo={useLoaded(demoAtom(props.id))} />;
}

/**
 * Demos run only in the browser: each has its own registry, timers and RPC
 * server in a Web Worker, none of which belong in prerendered HTML.
 */
export function DemoEmbed(props: { readonly id: string }) {
	return (
		<ClientOnly fallback={<DemoPlaceholder />}>
			<Suspense fallback={<DemoPlaceholder />}>
				<LoadedDemo id={props.id} />
			</Suspense>
		</ClientOnly>
	);
}
