"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

/**
 * Sets `.light` / `.dark` on `<html>`, which `@examples/ui/globals.css` reads,
 * and lets vanilla shadcn `Toaster` (sonner) read the theme. Follows the system
 * theme until the user picks one.
 */
export function ThemeProvider({
	children,
	...props
}: ComponentProps<typeof NextThemesProvider>) {
	return (
		<NextThemesProvider
			attribute="class"
			defaultTheme="system"
			disableTransitionOnChange
			enableSystem
			{...props}
		>
			{children}
		</NextThemesProvider>
	);
}
