import { AppHeader } from "@examples/kit/components/app-header";
import { Logo } from "@examples/kit/components/logo";
import { NavigationProgress } from "@examples/kit/components/navigation-progress";
import { SiteFooter } from "@examples/kit/components/site-footer";
import { ThemeProvider } from "@examples/kit/components/theme-provider";
import { exampleAppMeta, exampleApps } from "@examples/kit/lib/example-apps";
import { loaderVerbOf } from "@examples/kit/lib/loader-verb";
import { logoUrl } from "@examples/kit/lib/logo";
import { Toaster } from "@examples/ui/components/sonner";
import { WaterfallDetection } from "raf-effect-atom";
import {
	atomsMiddleware,
	RegistryProvider,
} from "raf-effect-atom/react-router";
import { type ReactNode, useState } from "react";
import {
	Links,
	Meta,
	Outlet,
	Scripts,
	ScrollRestoration,
	useLocation,
	useNavigation,
} from "react-router";

import { atomsContext } from "~/atoms.ts";
import { AppBoundary, AuthBoundary } from "~/boundaries.tsx";
import { AppLink, PrefetchContext } from "~/components/app-link.tsx";
import { Settings } from "~/components/settings.tsx";
import { requestCookie } from "~/issues.ts";
import { readSettings } from "~/settings.ts";

import type { Route } from "./+types/root";
import "./app.css";

export const links: Route.LinksFunction = () => [
	{ href: logoUrl, rel: "icon", type: "image/svg+xml" },
];

// No route below exports `meta`, so every page has the root's.
export const meta: Route.MetaFunction = () =>
	exampleAppMeta(exampleApps["react-router"]);

export const middleware: Array<Route.MiddlewareFunction> = [
	atomsMiddleware(atomsContext),
	// The backend reads the session and latency from cookies: atoms that run
	// in this request's registry send the page request's.
	(args) => {
		args.context
			.get(atomsContext)
			.registry.set(
				requestCookie,
				args.request.headers.get("cookie") ?? undefined,
			);
	},
];

export function loader(args: Route.LoaderArgs) {
	return readSettings(args.request.headers.get("cookie"));
}

export function Layout(props: { readonly children: ReactNode }) {
	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<meta charSet="utf-8" />
				<meta content="width=device-width, initial-scale=1" name="viewport" />
				<Meta />
				<Links />
			</head>
			<body className="flex min-h-screen flex-col antialiased">
				<ThemeProvider>
					<RegistryProvider>
						{/* In development, a component reading an atom no loader started throws. */}
						<WaterfallDetection mode="throw">
							{props.children}
						</WaterfallDetection>
					</RegistryProvider>
				</ThemeProvider>
				<ScrollRestoration />
				<Scripts />
			</body>
		</html>
	);
}

export default function App(props: Route.ComponentProps) {
	const [prefetch, setPrefetch] = useState(props.loaderData.prefetch);
	const verb = loaderVerbOf(useLocation().pathname);
	const navigating = useNavigation().state !== "idle";

	return (
		<PrefetchContext value={prefetch}>
			{navigating ? <NavigationProgress /> : null}
			<AppHeader
				brand={
					<AppLink
						className="flex shrink-0 items-center gap-2.5 font-semibold"
						to={`/${verb}/issues`}
					>
						<Logo alt="" />
						Issues
					</AppLink>
				}
				framework="React Router"
				loaders="server"
				settings={
					<Settings
						initial={props.loaderData}
						onPrefetchChange={setPrefetch}
						prefetch={prefetch}
						verb={verb}
					/>
				}
				verb={verb}
			/>
			<main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
				<AppBoundary>
					<AuthBoundary>
						<Outlet />
					</AuthBoundary>
				</AppBoundary>
			</main>
			<SiteFooter />
			<Toaster closeButton position="bottom-right" richColors />
		</PrefetchContext>
	);
}
