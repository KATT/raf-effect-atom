import { HydrationBoundary, RegistryProvider } from "raf-effect-atom";
import { ensure, getRegistry, prefetch } from "raf-effect-atom/rsc";
import { Suspense } from "react";

import { comments, post } from "./atoms.ts";
import { Comments } from "./comments.tsx";
import { Post } from "./post.tsx";

/** The docs' Next.js page and root layout, as one server component. */
export async function Page() {
	const commentsHandle = prefetch(comments, "hello");
	const postHandle = await ensure(post, "hello");
	return (
		<html lang="en">
			<body>
				<RegistryProvider>
					<HydrationBoundary registry={getRegistry()}>
						<Post handle={postHandle} />
						<Suspense fallback={<p>Loading comments…</p>}>
							<Comments handle={commentsHandle} />
						</Suspense>
					</HydrationBoundary>
				</RegistryProvider>
			</body>
		</html>
	);
}
