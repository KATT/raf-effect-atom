import {
	ErrorComponent,
	type ErrorComponentProps,
} from "@tanstack/react-router";
import { isModuleNotFoundError } from "@tanstack/router-core";

/**
 * TanStack Router's session key for a reload it made for this error, so a
 * chunk the router's route components already reloaded for isn't reloaded
 * for again.
 */
const reloadKey = (error: Error) => `tanstack_router_reload:${error.message}`;

/**
 * A chunk of the page's deployment that the request didn't reach, such as a
 * doc's content or a demo's code loaded in a loader, once another tab loaded
 * a newer deployment or the page outlived Skew Protection's max age, that the
 * page hasn't reloaded for yet this session.
 */
const isStaleChunk = (error: ErrorComponentProps["error"]): error is Error =>
	error instanceof Error &&
	isModuleNotFoundError(error) &&
	"sessionStorage" in globalThis &&
	sessionStorage.getItem(reloadKey(error)) === null;

/**
 * The router's `defaultOnCatch`: reloads the page for a stale chunk, once
 * per chunk per session, as TanStack Router's route components do, so a
 * chunk the latest deployment lacks too shows its error instead of
 * reloading forever.
 */
export function reloadForStaleChunk(error: ErrorComponentProps["error"]) {
	if (isStaleChunk(error)) {
		sessionStorage.setItem(reloadKey(error), "1");
		window.location.reload();
	}
}

/** The router's error page, blank while `reloadForStaleChunk` reloads. */
export function RouteError(props: ErrorComponentProps) {
	return isStaleChunk(props.error) ? null : (
		<ErrorComponent error={props.error} />
	);
}
