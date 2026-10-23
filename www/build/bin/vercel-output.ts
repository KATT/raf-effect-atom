#!/usr/bin/env node
/** Runs after `vp build`: turns `dist/client` into `.vercel/output`. */
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Effect } from "effect";

import { site } from "../../src/site.ts";
import { writeVercelOutput } from "../vercel-output.ts";

writeVercelOutput(new URL("../..", import.meta.url).pathname, {
	firstDoc: "overview",
	siteUrl: site.url,
}).pipe(Effect.provide(NodeServices.layer), NodeRuntime.runMain);
