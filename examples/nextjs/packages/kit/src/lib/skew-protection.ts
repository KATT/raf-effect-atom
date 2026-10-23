/**
 * [Vercel Skew Protection](https://vercel.com/docs/skew-protection) for the
 * Vite-built apps, which Vercel doesn't wire up on its own. A document comes
 * from the latest deployment; the requests the loaded page makes afterwards
 * go to the deployment that served it, for as long as the project's max age
 * keeps that deployment reachable.
 */

/**
 * Vite's `envPrefix` for the apps: its default, plus the two system
 * environment variables Vercel sets in the build, whole, so no other
 * `VERCEL_` variable reaches the browser.
 */
export const envPrefix = [
	"VITE_",
	"VERCEL_DEPLOYMENT_ID",
	"VERCEL_SKEW_PROTECTION_ENABLED",
];

declare global {
	/** The variables `envPrefix` adds to `import.meta.env`. */
	interface ImportMetaEnv {
		readonly VERCEL_DEPLOYMENT_ID?: string;
		readonly VERCEL_SKEW_PROTECTION_ENABLED?: string;
	}
}

/** The deployment that built this bundle, if its project has Skew Protection on. */
export const deploymentOf = (env: ImportMetaEnv): string | undefined =>
	env.VERCEL_SKEW_PROTECTION_ENABLED === "1"
		? env.VERCEL_DEPLOYMENT_ID
		: undefined;

/** Headers that send a `fetch` to `deploymentId`. */
export const deploymentHeaders = (
	deploymentId: string | undefined,
): Readonly<Record<string, string>> =>
	deploymentId === undefined ? {} : { "x-deployment-id": deploymentId };

/**
 * Sends the page's `/assets` requests (chunks, CSS, workers, fonts) to
 * `deploymentId`, with the `__vdpl` cookie. A chunk import can't carry a
 * header, and a query on one module doesn't reach the modules it imports.
 * The cookie's path is `/assets` because Vercel also routes documents by it,
 * and a reload should get the latest deployment. A tab from a newer
 * deployment overwrites it, so each tab sets it again when it's focused.
 * Does nothing outside the browser or without a deployment.
 */
export function pinAssets(deploymentId: string | undefined) {
	if (deploymentId === undefined || !("document" in globalThis)) {
		return;
	}
	const pin = () => {
		document.cookie = `__vdpl=${deploymentId}; Path=/assets; SameSite=Lax; Secure`;
	};
	pin();
	window.addEventListener("focus", pin);
	window.addEventListener("pageshow", pin);
}
