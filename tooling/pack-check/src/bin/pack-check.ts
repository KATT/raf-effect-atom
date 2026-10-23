#!/usr/bin/env node
/**
 * `pack-check`, after `pnpm build`: packs every publishable package in
 * `packages/` the way its release does, fails when a tarball is missing
 * something npm users need, then installs the tarballs into a fresh npm
 * project and imports and type-checks every subpath.
 */
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Console, Data, Effect, FileSystem, Path } from "effect";
import { Command } from "effect/cli";

import { tarballProblems } from "../check.ts";
import { clientSources, consume, pack, publishableDirs } from "../pack.ts";

class BrokenTarballs extends Data.TaggedError("BrokenTarballs")<{
	readonly count: number;
}> {
	override get message() {
		return `${this.count} problem(s) in the packed packages.`;
	}
}

const packCheck = Command.make(
	"pack-check",
	{},
	Effect.fn(function* () {
		const fs = yield* FileSystem.FileSystem;
		const path = yield* Path.Path;
		const root = path.resolve(import.meta.dirname, "../../../..");
		const outDir = yield* fs.makeTempDirectoryScoped({ prefix: "pack-check-" });

		const packed = [];
		let problems = 0;
		for (const dir of yield* publishableDirs(root)) {
			const entry = yield* pack(dir, outDir);
			const { manifest } = entry.tarball;
			const found = tarballProblems(entry.tarball, yield* clientSources(dir));
			yield* Console.log(
				`${manifest.name}@${manifest.version}: ${entry.tarball.files.length} files, ${found.length} problems`,
			);
			for (const problem of found) {
				yield* Console.error(`  ${manifest.name}: ${problem}`);
			}
			problems += found.length;
			packed.push(entry);
		}
		if (problems > 0) {
			return yield* new BrokenTarballs({ count: problems });
		}
		yield* consume(root, outDir, packed);
	}, Effect.scoped),
);

Command.run(packCheck, { version: "0.0.0" }).pipe(
	Effect.provide(NodeServices.layer),
	NodeRuntime.runMain,
);
