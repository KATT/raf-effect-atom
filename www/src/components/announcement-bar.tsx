import { Button } from "@examples/ui/components/button";
import { X } from "lucide-react";
import type { ReactNode } from "react";

const storageKey = "raf-effect-atom-docs:announcement-dismissed";

/**
 * The bar's messages. Each has its own `id`, so readers who dismissed one
 * see the next.
 */
const announcements = {
	early: {
		id: "early-minor",
		message: (
			<>
				<strong className="font-semibold">raf-effect-atom is early.</strong>{" "}
				Both packages can still change between minor releases, so use them at
				your own risk.
			</>
		),
	},
} satisfies Record<string, { id: string; message: ReactNode }>;

const announcement = announcements.early;

/** Set on `<html>` once dismissed; `styles.css` hides the bar under it. */
const dismissedAttribute = "data-announcement-dismissed";

/** Runs before first paint, so a dismissed bar never flashes in the prerendered HTML. */
export const announcementScript = `(() => {
	try {
		if (localStorage.getItem(${JSON.stringify(storageKey)}) === ${JSON.stringify(announcement.id)}) {
			document.documentElement.setAttribute(${JSON.stringify(dismissedAttribute)}, "");
		}
	} catch {}
})();`;

export function AnnouncementBar() {
	return (
		<div
			aria-label="Announcement"
			className="announcement-bar bg-primary text-primary-foreground"
			role="region"
		>
			<div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-1.5 sm:px-6">
				<p className="flex-1 text-center text-sm">{announcement.message}</p>
				<Button
					aria-label="Dismiss announcement"
					className="hover:bg-primary-foreground/15 hover:text-primary-foreground dark:hover:bg-primary-foreground/15"
					onClick={() => {
						document.documentElement.setAttribute(dismissedAttribute, "");
						localStorage.setItem(storageKey, announcement.id);
					}}
					size="icon-xs"
					title="Dismiss announcement"
					variant="ghost"
				>
					<X />
				</Button>
			</div>
		</div>
	);
}
