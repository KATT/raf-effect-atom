import type { ReactNode } from "react";

import { PoweredByVercel } from "@examples/kit/components/powered-by-vercel";

const github = "https://github.com/KATT/raf-effect-atom";

/**
 * The footer every deployed app renders, so each one carries the Vercel badge.
 * `children` are extra links placed before GitHub, e.g. the app's router
 * `<Link>`s; give them `className="hover:text-foreground"` to match.
 */
export function SiteFooter(props: { children?: ReactNode }) {
	return (
		<footer className="border-t">
			<div className="mx-auto grid max-w-7xl justify-items-start gap-2 px-4 py-8 text-sm text-muted-foreground sm:px-6 md:flex md:items-center md:justify-between md:gap-6">
				<p>raf-effect-atom is MIT licensed.</p>
				<div className="grid justify-items-start gap-4 md:flex md:items-center md:gap-6">
					<nav aria-label="Footer" className="flex flex-wrap gap-x-4 gap-y-2">
						{props.children}
						<a className="hover:text-foreground" href={github}>
							GitHub
						</a>
					</nav>
					<PoweredByVercel />
				</div>
			</div>
		</footer>
	);
}
