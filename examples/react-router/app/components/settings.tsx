import { SettingsControls } from "@examples/kit/components/settings";
import {
	type LoaderVerb,
	loaderVerbs,
	withLoaderVerb,
} from "@examples/kit/lib/loader-verb";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router";

import {
	clearSettings,
	parsePrefetch,
	type Prefetch,
	prefetchOptions,
	type Settings as SettingsValues,
	writeLatency,
	writePrefetch,
	writeSession,
} from "~/settings.ts";

/**
 * The top bar's settings, kept in cookies so the server renders with them.
 * The verb is the URL's first segment; changing it opens the same page under
 * the other verb.
 */
export function Settings(props: {
	/** As the page request's cookies said. */
	readonly initial: SettingsValues;
	readonly onPrefetchChange: (prefetch: Prefetch) => void;
	readonly prefetch: Prefetch;
	readonly verb: LoaderVerb;
}) {
	const navigate = useNavigate();
	const location = useLocation();
	const [latency, setLatency] = useState(props.initial.latency);
	return (
		<SettingsControls
			latency={latency}
			onLatencyChange={(value) => {
				writeLatency(value);
				setLatency(Number(value));
			}}
			onPrefetchChange={(value) => {
				const next = parsePrefetch(value);
				writePrefetch(next);
				props.onPrefetchChange(next);
			}}
			onReset={() => {
				clearSettings();
				window.location.reload();
			}}
			onSessionChange={(value) => {
				writeSession(value === "signed-out" ? "signed-out" : "signed-in");
				// Every atom on the page ran as the old session.
				window.location.reload();
			}}
			onVerbChange={(value) => {
				const verb = loaderVerbs.find((option) => option === value);
				if (verb !== undefined) {
					void navigate(withLoaderVerb(location, verb));
				}
			}}
			prefetch={props.prefetch}
			prefetchOptions={prefetchOptions}
			session={props.initial.session}
			verb={props.verb}
		/>
	);
}
