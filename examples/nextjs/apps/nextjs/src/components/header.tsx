"use client";

import { AppHeader } from "@examples/kit/components/app-header";
import { Logo } from "@examples/kit/components/logo";
import { loaderVerbOf } from "@examples/kit/lib/loader-verb";
import { usePathname } from "next/navigation";

import type { Settings as SettingsValues } from "~/settings.ts";

import { AppLink, Settings } from "./settings.tsx";

/** The top bar, under the URL's verb. */
export function Header(props: { readonly settings: SettingsValues }) {
	const verb = loaderVerbOf(usePathname());
	return (
		<AppHeader
			brand={
				<AppLink
					className="flex shrink-0 items-center gap-2.5 font-semibold"
					href={`/${verb}/issues`}
				>
					<Logo alt="" />
					Issues
				</AppLink>
			}
			framework="Next.js"
			loaders="server"
			settings={<Settings initial={props.settings} verb={verb} />}
			verb={verb}
		/>
	);
}
