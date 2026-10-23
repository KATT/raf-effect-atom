import "./globals.css";

import { SiteFooter } from "@examples/kit/components/site-footer";
import { ThemeProvider } from "@examples/kit/components/theme-provider";
import { logoUrl } from "@examples/kit/lib/logo";
import { Toaster } from "@examples/ui/components/sonner";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { RegistryProvider } from "raf-effect-atom/next";
import type { ReactNode } from "react";

import { AuthBoundary } from "~/boundaries.tsx";
import { Header } from "~/components/header.tsx";
import { SettingsProvider } from "~/components/settings.tsx";
import { parseSettings } from "~/settings.ts";

export const metadata = {
	icons: { icon: logoUrl },
	title: "Issues · raf-effect-atom on Next.js",
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
					{/* The browser's registry, which every page's `HydrateAtoms` fills. */}
					<RegistryProvider>
						<SettingsProvider prefetch={settings.prefetch}>
							<Header settings={settings} />
							<main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
								<AuthBoundary>{props.children}</AuthBoundary>
							</main>
						</SettingsProvider>
					</RegistryProvider>
					<SiteFooter />
					<Toaster closeButton position="bottom-right" richColors />
				</ThemeProvider>
			</body>
		</html>
	);
}
