import "./globals.css";

import { SiteFooter } from "@examples/kit/components/site-footer";
import { ThemeProvider } from "@examples/kit/components/theme-provider";
import {
	exampleAppDescription,
	exampleApps,
	exampleAppTitle,
} from "@examples/kit/lib/example-apps";
import { logoUrl } from "@examples/kit/lib/logo";
import { Toaster } from "@examples/ui/components/sonner";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { RegistryProvider, WaterfallDetection } from "raf-effect-atom";
import type { ReactNode } from "react";

import { AppBoundary, AuthBoundary } from "~/boundaries.tsx";
import { Header } from "~/components/header.tsx";
import { SettingsProvider } from "~/components/settings.tsx";
import { parseSettings } from "~/settings.ts";

const app = exampleApps.nextjs;
const title = exampleAppTitle(app);
const description = exampleAppDescription(app);
const image = {
	alt: title,
	height: 630,
	type: "image/png",
	url: `${app.url}/og.png`,
	width: 1200,
};

export const metadata = {
	description,
	icons: { icon: logoUrl },
	openGraph: {
		description,
		images: [image],
		siteName: "raf-effect-atom",
		title,
		type: "website",
		url: app.url,
	},
	title,
	twitter: {
		card: "summary_large_image",
		description,
		images: [image],
		title,
	},
} satisfies Metadata;

export default async function RootLayout(props: {
	readonly children: ReactNode;
}) {
	const cookieStore = await cookies();
	const settings = parseSettings((name) => cookieStore.get(name)?.value);

	return (
		<html lang="en" suppressHydrationWarning>
			<body className="flex min-h-screen flex-col antialiased">
				<ThemeProvider>
					{/* The browser's registry, which every page's `HydrationBoundary` fills. */}
					<RegistryProvider>
						{/* In development, a component reading an atom no server component started throws. */}
						<WaterfallDetection mode="throw">
							<SettingsProvider prefetch={settings.prefetch}>
								<Header settings={settings} />
								<main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
									<AppBoundary>
										<AuthBoundary>{props.children}</AuthBoundary>
									</AppBoundary>
								</main>
							</SettingsProvider>
						</WaterfallDetection>
					</RegistryProvider>
					<SiteFooter />
					<Toaster closeButton position="bottom-right" richColors />
				</ThemeProvider>
			</body>
		</html>
	);
}
