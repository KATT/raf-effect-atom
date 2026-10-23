/// <reference types="vite-plus/client" />
import { AppHeader } from "@examples/kit/components/app-header";
import { Logo } from "@examples/kit/components/logo";
import { NavigationProgress } from "@examples/kit/components/navigation-progress";
import { SiteFooter } from "@examples/kit/components/site-footer";
import { ThemeProvider } from "@examples/kit/components/theme-provider";
import { loaderVerbOf } from "@examples/kit/lib/loader-verb";
import { logoUrl } from "@examples/kit/lib/logo";
import { Toaster } from "@examples/ui/components/sonner";
import {
	createRootRouteWithContext,
	HeadContent,
	Link,
	Outlet,
	Scripts,
	useLocation,
	useRouter,
	useRouterState,
} from "@tanstack/react-router";
import type { Loader } from "raf-effect-atom";
import { type ReactNode, useState } from "react";

import { AuthBoundary } from "~/boundaries.tsx";
import { Settings } from "~/components/settings.tsx";
import { readPrefetch, toDefaultPreload } from "~/settings.ts";
import appCss from "~/styles.css?url";

export const Route = createRootRouteWithContext<{
	readonly atoms: Loader.Loader;
}>()({
	head: () => ({
		links: [
			{ href: appCss, rel: "stylesheet" },
			{ href: logoUrl, rel: "icon", type: "image/svg+xml" },
		],
		meta: [
			{ charSet: "utf8" },
			{ content: "width=device-width, initial-scale=1", name: "viewport" },
			{ title: "Issues · raf-effect-atom on TanStack Start" },
		],
	}),
	component: Outlet,
	notFoundComponent: () => (
		<p className="text-muted-foreground">Nothing here.</p>
	),
	shellComponent: RootDocument,
});

function RootDocument(props: { readonly children: ReactNode }) {
	const router = useRouter();
	const [prefetch, setPrefetch] = useState(readPrefetch);
	const verb = loaderVerbOf(
		useLocation({ select: (location) => location.pathname }),
	);
	const navigating = useRouterState({
		select: (state) => state.status === "pending",
	});

	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<HeadContent />
			</head>
			<body className="flex min-h-screen flex-col antialiased">
				<ThemeProvider>
					{navigating ? <NavigationProgress /> : null}
					<AppHeader
						brand={
							<Link
								className="flex shrink-0 items-center gap-2.5 font-semibold"
								key={prefetch}
								to={`/${verb}/issues`}
							>
								<Logo alt="" />
								Issues
							</Link>
						}
						framework="TanStack Start"
						loaders="browser"
						settings={
							<Settings
								onPrefetchChange={(next) => {
									router.update({
										...router.options,
										defaultPreload: toDefaultPreload(next),
									});
									setPrefetch(next);
								}}
								prefetch={prefetch}
								verb={verb}
							/>
						}
						verb={verb}
					/>
					{/* Remounts the page, so every `Link` picks up a new prefetch setting. */}
					<main
						className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 sm:py-8"
						key={prefetch}
					>
						<AuthBoundary>{props.children}</AuthBoundary>
					</main>
					<SiteFooter />
					<Toaster closeButton position="bottom-right" richColors />
				</ThemeProvider>
				<Scripts />
			</body>
		</html>
	);
}
