import {
	createMemoryHistory,
	createRootRouteWithContext,
	createRoute,
	createRouter,
	Outlet,
	RouterProvider,
	useLoaderData,
} from "@tanstack/react-router";
import { hydrate } from "@tanstack/react-router/ssr/client";
import {
	attachRouterServerSsrUtils,
	renderRouterToStream,
	RouterServer,
} from "@tanstack/react-router/ssr/server";
import { act, render } from "@testing-library/react";
import * as Option from "effect/Option";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as Schema from "effect/Schema";
import * as React from "react";

import {
	type Handle,
	Loader,
	RequestRegistry,
	useAtomResult,
} from "../../src/index.ts";
import { setupRouterAtoms } from "../../src/TanStackRouter.tsx";
import { mount, settle } from "./browser.tsx";
import { greeting, issue, IssueNotFound } from "./issues.ts";

const isIssueNotFound = Schema.is(IssueNotFound);

function IssuePage() {
	// SAFETY: both routes below return `{ issue }`, the issue's handle.
	const data = useLoaderData({ strict: false }) as {
		readonly issue: Handle<typeof issue>;
	};
	const result = useAtomResult(issue, data.issue);
	if (AsyncResult.isSuccess(result)) {
		return <p>{result.value.title}</p>;
	}
	const error = AsyncResult.error(result);
	if (Option.isNone(error)) {
		return <p>Defect</p>;
	}
	return (
		<p>
			{isIssueNotFound(error.value)
				? `IssueNotFound ${error.value.id}`
				: `Not an IssueNotFound: ${error.value._tag}`}
		</p>
	);
}

const rootRoute = createRootRouteWithContext<{
	readonly atoms: Loader.Loader;
}>()({
	component: () => (
		<React.Suspense fallback={<p>Loading</p>}>
			<Outlet />
		</React.Suspense>
	),
});

/** `/issues/$id` waits for the issue in its loader. */
const ensureRoute = createRoute({
	component: IssuePage,
	getParentRoute: () => rootRoute,
	loader: async (match) => ({
		issue: await match.context.atoms.ensure(issue, Number(match.params.id)),
	}),
	path: "/issues/$id",
});

/** `/streamed/$id` starts the issue in its loader and streams it. */
const prefetchRoute = createRoute({
	component: IssuePage,
	getParentRoute: () => rootRoute,
	loader: (match) => ({
		issue: match.context.atoms.prefetch(issue, Number(match.params.id)),
	}),
	path: "/streamed/$id",
});

/** `/greeting` starts the greeting, which reads what the seed sets. */
const greetingRoute = createRoute({
	component: function GreetingPage() {
		const data = greetingRoute.useLoaderData();
		const result = useAtomResult(greeting, data.greeting);
		return <p>{AsyncResult.isSuccess(result) ? result.value : "Failed"}</p>;
	},
	getParentRoute: () => rootRoute,
	loader: (match) => ({ greeting: match.context.atoms.prefetch(greeting) }),
	path: "/greeting",
});

const routeTree = rootRoute.addChildren([
	ensureRoute,
	prefetchRoute,
	greetingRoute,
]);

/**
 * A router with its own `Wrap`, `dehydrate` and `hydrate`, as an app's might
 * have, and the atoms set up.
 */
const makeRouter = (
	url: string,
	registry: AtomRegistry.AtomRegistry,
	isServer: boolean,
	hydrated: Array<unknown> = [],
) => {
	const router = createRouter({
		context: { atoms: Loader.make(registry) },
		dehydrate: () => ({ app: "state" }),
		history: createMemoryHistory({ initialEntries: [url] }),
		hydrate: (dehydrated) => {
			hydrated.push(dehydrated.app);
		},
		isServer,
		routeTree,
		Wrap: (props) => <main>{props.children}</main>,
	});
	setupRouterAtoms({ registry, router });
	return router;
};

/**
 * Renders a URL on a server router, as TanStack Start does for one request,
 * and returns the streamed response's HTML with its hydration scripts.
 */
export const renderOnServer = async (
	url: string,
	options?: RequestRegistry.Options,
) => {
	const registry = RequestRegistry.make(options);
	const router = makeRouter(url, registry, true);
	attachRouterServerSsrUtils({ manifest: undefined, router });
	await router.load();
	await router.serverSsr!.dehydrate();
	const response = await renderRouterToStream({
		children: <RouterServer router={router} />,
		request: new Request(`http://localhost${url}`),
		responseHeaders: new Headers(),
		router,
	});
	return { html: await response.response.text(), registry };
};

/**
 * Runs a server response's router scripts in the page, hydrates a browser
 * router from them, and renders it. React's own scripts are left out: they
 * move server-rendered HTML, which the browser render doesn't use.
 */
export const renderInBrowser = async (url: string, html: string) => {
	const template = document.createElement("template");
	template.innerHTML = html;
	for (const sent of template.content.querySelectorAll("script")) {
		if (!sent.textContent.includes('$R["tsr"]')) {
			continue;
		}
		const script = document.createElement("script");
		script.textContent = sent.textContent;
		document.body.append(script);
	}
	const app = mount();
	const hydrated: Array<unknown> = [];
	const router = makeRouter(url, app.registry, false, hydrated);
	await act(async () => {
		await hydrate(router);
		window.$_TSR?.h();
	});
	await act(async () => {
		render(<RouterProvider router={router} />);
	});
	await settle();
	return { ...app, hydrated };
};
