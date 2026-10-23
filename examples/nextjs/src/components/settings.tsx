"use client";

import { NavigationProgress } from "@examples/kit/components/navigation-progress";
import { SettingsControls } from "@examples/kit/components/settings";
import {
	type LoaderVerb,
	loaderVerbs,
	withLoaderVerb,
} from "@examples/kit/lib/loader-verb";
import Link, { useLinkStatus } from "next/link";
import { useRouter } from "next/navigation";
import {
	type ComponentProps,
	createContext,
	type ReactNode,
	use,
	useState,
	useTransition,
} from "react";

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

const PrefetchContext = createContext<{
	readonly prefetch: Prefetch;
	readonly setPrefetch: (prefetch: Prefetch) => void;
}>({ prefetch: "off", setPrefetch: () => {} });

/** Holds the prefetch setting, starting from the value in its cookie. */
export function SettingsProvider(props: {
	readonly children: ReactNode;
	readonly prefetch: Prefetch;
}) {
	const [prefetch, setPrefetch] = useState(props.prefetch);
	return (
		<PrefetchContext value={{ prefetch, setPrefetch }}>
			{props.children}
		</PrefetchContext>
	);
}

/**
 * The top bar's settings, kept in cookies so the server renders with them.
 * The verb is the URL's first segment; changing it opens the same page under
 * the other verb.
 */
export function Settings(props: {
	readonly initial: SettingsValues;
	readonly verb: LoaderVerb;
}) {
	const router = useRouter();
	const settings = use(PrefetchContext);
	const [latency, setLatency] = useState(props.initial.latency);
	const [switchingVerb, startSwitchingVerb] = useTransition();
	return (
		<>
			{switchingVerb ? <NavigationProgress /> : null}
			<SettingsControls
				latency={latency}
				onLatencyChange={(value) => {
					writeLatency(value);
					setLatency(Number(value));
				}}
				onPrefetchChange={(value) => {
					const next = parsePrefetch(value);
					writePrefetch(next);
					settings.setPrefetch(next);
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
						startSwitchingVerb(() => {
							router.push(withLoaderVerb(window.location, verb));
						});
					}
				}}
				prefetch={settings.prefetch}
				prefetchOptions={prefetchOptions}
				session={props.initial.session}
				verb={props.verb}
			/>
		</>
	);
}

/**
 * `next/link`, prefetching as the settings say. Off passes `prefetch={false}`,
 * in the viewport passes `true`, and "On intent" passes `true` once the
 * pointer or focus reaches the link. Next.js only prefetches in production
 * builds.
 */
export function AppLink(props: ComponentProps<typeof Link>) {
	const { children, ...link } = props;
	const settings = use(PrefetchContext);
	const [intent, setIntent] = useState(false);

	if (settings.prefetch !== "intent") {
		return (
			<Link {...link} prefetch={settings.prefetch === "viewport"}>
				{children}
				<LinkProgress />
			</Link>
		);
	}
	const showIntent = () => {
		setIntent(true);
	};
	return (
		<Link
			{...link}
			onFocus={showIntent}
			onMouseEnter={showIntent}
			onTouchStart={showIntent}
			prefetch={intent}
		>
			{children}
			<LinkProgress />
		</Link>
	);
}

/**
 * Next.js has no app-wide navigation state, only `useLinkStatus` for the
 * `Link` it's rendered in, so every `AppLink` shows the bar while its own
 * navigation is pending.
 */
function LinkProgress() {
	const status = useLinkStatus();
	return status.pending ? <NavigationProgress /> : null;
}
