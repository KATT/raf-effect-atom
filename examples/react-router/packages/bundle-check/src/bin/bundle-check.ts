#!/usr/bin/env node
/**
 * `bundle-check <client-dir> --forbid <package>...`, run from the app's
 * directory after its build: exits 1 when the client build contains code
 * from a forbidden package.
 */
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Console, Data, Effect, Path } from "effect";
import { Argument, Command, Flag } from "effect/cli";

import { check } from "../check.ts";
import { forbiddenPackages, workspaceRoot } from "../workspace.ts";

class ForbiddenCode extends Data.TaggedError("ForbiddenCode")<{
	readonly count: number;
}> {
	override get message() {
		return `The client build has ${this.count} source(s) from forbidden packages.`;
	}
}

const bundleCheck = Command.make(
	"bundle-check",
	{
		clientDir: Argument.Directory("client-dir", { mustExist: true }).pipe(
			Argument.withDescription(
				"The app's client build output: what the browser downloads",
			),
		),
		forbid: Flag.String("forbid").pipe(
			Flag.atLeast(1),
			Flag.withDescription("A package the browser must never get"),
		),
	},
	Effect.fn(function* (input) {
		const path = yield* Path.Path;
		const clientDir = path.resolve(input.clientDir);
		const root = yield* workspaceRoot(clientDir);
		const forbidden = yield* forbiddenPackages(root, input.forbid);
		const report = yield* check({ clientDir, forbidden, root });

		const where = path.relative(process.cwd(), clientDir) || ".";
		yield* Console.log(
			`Checked ${report.chunks.length} chunks in ${where} for ${input.forbid.join(", ")}.`,
		);
		if (report.unmapped.length > 0) {
			yield* Console.log(
				`No source map, not checked: ${report.unmapped.join(", ")}`,
			);
		}
		if (report.leaks.length === 0) {
			yield* Console.log("None of them is in the client build.");
			return;
		}
		for (const leak of report.leaks) {
			yield* Console.error(
				`${leak.chunk}: ${leak.packageName} (${leak.source})`,
			);
		}
		return yield* new ForbiddenCode({ count: report.leaks.length });
	}),
);

Command.run(bundleCheck, { version: "0.0.0" }).pipe(
	Effect.provide(NodeServices.layer),
	NodeRuntime.runMain,
);
