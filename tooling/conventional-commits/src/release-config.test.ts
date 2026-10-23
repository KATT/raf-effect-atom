import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Path, Schema } from "effect";

import { releaseTypes } from "./types.ts";
import { validateSubject } from "./validate.ts";

const PathOption = Schema.Struct({ path: Schema.String });

const ReleaseIt = Schema.fromJsonString(
	Schema.Struct({
		git: Schema.Struct({
			commitMessage: Schema.String,
			commitsPath: Schema.String,
			tagName: Schema.String,
		}),
		github: Schema.Struct({ releaseName: Schema.String }),
		hooks: Schema.Struct({
			"after:bump": Schema.String,
			"before:git:release": Schema.String,
		}),
		plugins: Schema.Struct({
			"@release-it/conventional-changelog": Schema.Struct({
				commitsOpts: PathOption,
				gitRawCommitsOpts: PathOption,
				infile: Schema.String,
				preset: Schema.Struct({
					types: Schema.Array(
						Schema.Struct({
							effect: Schema.Literals(["bump", "changelog"]),
							section: Schema.String,
							type: Schema.String,
						}),
					),
				}),
				tagPrefix: Schema.String,
			}),
		}),
	}),
);

const PackageJson = Schema.fromJsonString(
	Schema.Struct({
		name: Schema.String,
		private: Schema.optional(Schema.Boolean),
	}),
);

const root = Effect.map(Path.Path, (path) =>
	path.join(import.meta.dirname, "../../.."),
);

const releaseConfigs = Effect.gen(function* () {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const dir = path.join(yield* root, "release-it");
	const files = (yield* fs.readDirectory(dir))
		.filter((file) => file.endsWith(".json"))
		.toSorted();
	return yield* Effect.forEach(files, (file) =>
		fs.readFileString(path.join(dir, file)).pipe(
			Effect.flatMap(Schema.decodeEffect(ReleaseIt)),
			Effect.map((config) => ({
				config,
				name: path.basename(file, ".json"),
			})),
		),
	);
});

describe("release-it/<package>.json", () => {
	it.effect("lists the commit types, with feat/fix/perf bumping", () =>
		Effect.gen(function* () {
			const configs = yield* releaseConfigs;
			expect(configs.length).toBeGreaterThan(0);
			for (const { config } of configs) {
				const types =
					config.plugins["@release-it/conventional-changelog"].preset.types;
				expect(types.map((entry) => entry.type).toSorted()).toEqual(
					releaseTypes.toSorted(),
				);
				expect(
					types
						.filter((entry) => entry.effect === "bump")
						.map((entry) => entry.type),
				).toEqual(["feat", "fix", "perf"]);
			}
		}).pipe(Effect.provide(NodeServices.layer)),
	);

	it.effect("scopes each release to its own package", () =>
		Effect.gen(function* () {
			for (const { config, name } of yield* releaseConfigs) {
				const changelog = config.plugins["@release-it/conventional-changelog"];
				const dir = `packages/${name}`;
				expect(config.git.commitsPath).toBe(dir);
				expect(changelog.commitsOpts.path).toBe(dir);
				expect(changelog.gitRawCommitsOpts.path).toBe(dir);
				expect(changelog.infile).toBe(`${dir}/CHANGELOG.md`);
				expect(config.git.tagName).toBe(`${name}@\${version}`);
				expect(changelog.tagPrefix).toBe(`${name}@`);
				expect(config.github.releaseName).toBe(config.git.tagName);
				expect(config.git.commitMessage).toBe(
					`chore(release): ${name}@\${version}`,
				);
				expect(
					validateSubject(
						config.git.commitMessage.replace("${version}", "1.2.3"),
					).ok,
				).toBe(true);
				expect(config.hooks["after:bump"]).toContain(`--filter ${name} `);
				// `files` lists LICENSE; the package directory has no copy.
				expect(config.hooks["before:git:release"]).toContain(
					`cp LICENSE ${dir}/LICENSE`,
				);
				expect(config.hooks["before:git:release"]).toContain(
					`pnpm --filter ${name} run publish:npm`,
				);
			}
		}).pipe(Effect.provide(NodeServices.layer)),
	);

	it.effect("exists for every publishable package and the workflow", () =>
		Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			const path = yield* Path.Path;
			const repo = yield* root;
			const names = (yield* releaseConfigs).map((entry) => entry.name);
			const workflow = yield* fs.readFileString(
				path.join(repo, ".github/workflows/release.yaml"),
			);
			for (const name of names) {
				expect(workflow).toContain(`- ${name}\n`);
			}
			for (const dir of yield* fs.readDirectory(path.join(repo, "packages"))) {
				const manifest = path.join(repo, "packages", dir, "package.json");
				if (!(yield* fs.exists(manifest))) {
					continue;
				}
				const pkg = yield* Schema.decodeEffect(PackageJson)(
					yield* fs.readFileString(manifest),
				);
				if (pkg.private !== true) {
					expect(pkg.name).toBe(dir);
					expect(names).toContain(pkg.name);
				}
			}
		}).pipe(Effect.provide(NodeServices.layer)),
	);
});
