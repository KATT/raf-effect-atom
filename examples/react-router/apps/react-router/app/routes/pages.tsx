import { isRouteErrorResponse } from "react-router";

import { NotFound } from "~/components/not-found.tsx";

import type { Route } from "./+types/pages";

export { Outlet as default } from "react-router";

/**
 * A loader's 404, under the root's header: an id that isn't a number, or a
 * search the list can't read. An issue that doesn't exist is the
 * `IssueBoundary`'s, inside the page.
 */
export function ErrorBoundary(props: Route.ErrorBoundaryProps) {
	if (isRouteErrorResponse(props.error) && props.error.status === 404) {
		return <NotFound />;
	}
	throw props.error;
}
