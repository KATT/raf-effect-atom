#!/usr/bin/env node
/**
 * `example-og-image <app> <file>`, run from the app's directory before its
 * build: renders the app's social card to `file` (its `public/og.png`).
 */
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { OgCard, writeOgImage } from "@tooling/og-image/render";
import { Console, Effect } from "effect";
import { Argument, Command } from "effect/cli";

import { exampleApps } from "../lib/example-apps.ts";
import { logoSvg } from "../lib/logo.ts";

const ids = [
	"nextjs",
	"react-router",
	"tanstack-start",
] as const satisfies ReadonlyArray<keyof typeof exampleApps>;

const exampleOgImage = Command.make(
	"example-og-image",
	{
		app: Argument.Literals("app", ids).pipe(
			Argument.withDescription("The example app whose card to render"),
		),
		file: Argument.Path("file").pipe(
			Argument.withDescription("Where to write the PNG"),
		),
	},
	Effect.fn(function* (input) {
		const app = exampleApps[input.app];
		yield* writeOgImage(
			OgCard.Page({
				description: app.pitch,
				eyebrow: app.framework,
				path: "/og.png",
				pill: "Example app",
				title: "The issue tracker",
				url: app.url,
			}),
			input.file,
			{ logoSvg },
		);
		yield* Console.log(`Wrote ${input.app}'s social card to ${input.file}.`);
	}),
);

Command.run(exampleOgImage, { version: "0.0.0" }).pipe(
	Effect.provide(NodeServices.layer),
	NodeRuntime.runMain,
);
