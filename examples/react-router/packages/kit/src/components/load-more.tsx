import { Button } from "@examples/ui/components/button";

/**
 * Infinite scroll: a "Load more" button that presses itself when it comes
 * within `rootMargin` of the viewport. Unmount it once pressed (and show the
 * next page's skeletons in its place); the next page's own button watches
 * again, so it keeps loading while it stays in reach.
 */
export function LoadMore(props: { readonly onLoad: () => void }) {
	return (
		<Button
			className="w-full"
			onClick={props.onLoad}
			ref={(button) => {
				if (button === null) {
					return;
				}
				const observer = new IntersectionObserver(
					(entries) => {
						if (entries.some((entry) => entry.isIntersecting)) {
							observer.disconnect();
							props.onLoad();
						}
					},
					{ rootMargin: "0px 0px 300px 0px" },
				);
				observer.observe(button);
				return () => {
					observer.disconnect();
				};
			}}
			variant="outline"
		>
			Load more
		</Button>
	);
}
