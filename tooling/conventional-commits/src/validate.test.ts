import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Path, Schema } from "effect";

import { releaseTypes } from "./types.ts";
import { formatError, validateSubject } from "./validate.ts";

const ReleaseIt = Schema.fromJsonString(
	Schema.Struct({
		git: Schema.Struct({ commitsPath: Schema.String }),
		plugins: Schema.Struct({
			"@release-it/conventional-changelog": Schema.Struct({
				commitsOpts: Schema.Struct({ path: Schema.String }),
				gitRawCommitsOpts: Schema.Struct({ path: Schema.String }),
				preset: Schema.Struct({
					types: Schema.Array(
						Schema.Struct({
							effect: Schema.Literals(["bump", "changelog"]),
							section: Schema.String,
							type: Schema.String,
						}),
					),
				}),
			}),
		}),
	}),
);

describe("validateSubject", () => {
	it.effect("matches the types and package paths in .release-it.json", () =>
		Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			const path = yield* Path.Path;
			const releaseIt = yield* Schema.decodeEffect(ReleaseIt)(
				yield* fs.readFileString(
					path.join(import.meta.dirname, "../../../.release-it.json"),
				),
			);
			const changelog = releaseIt.plugins["@release-it/conventional-changelog"];
			const types = changelog.preset.types;
			expect(releaseTypes.toSorted()).toEqual(
				types.map((entry) => entry.type).toSorted(),
			);
			// Same packages/* as the release gate (git.commitsPath).
			expect(changelog.commitsOpts.path).toBe("packages/*");
			expect(changelog.gitRawCommitsOpts.path).toBe("packages/*");
			expect(releaseIt.git.commitsPath).toBe("packages/*");
			expect(
				types
					.filter((entry) => entry.effect === "bump")
					.map((entry) => entry.type),
			).toEqual(["feat", "fix", "perf"]);
		}).pipe(Effect.provide(NodeServices.layer)),
	);

	it.each([
		"feat: add loader verbs",
		"fix(raf-effect-atom)!: prefetch keeps the atom mounted",
		"feat!: rename the read hook",
		"docs(boundary): show the compile error for a misspelled tag",
		"ci: check commit subjects on push",
		"chore: release v0.1.0",
		"test(boundary): pin the request count after a caught failure",
		"style: tidy the demo layout",
		"build: bump vite-plus",
		"perf: skip a render when the result didn't change",
		"refactor(examples): share the RPC contract",
	])("accepts %s", (subject) => {
		expect(validateSubject(subject).ok).toBe(true);
	});

	it("parses type, scope, breaking and description", () => {
		expect(validateSubject("fix(core)!: fetch waits for stale data")).toEqual({
			ok: true,
			parsed: {
				breaking: true,
				scope: "core",
				subject: "fetch waits for stale data",
				type: "fix",
			},
		});
	});

	it.each([
		["", "subject is empty"],
		["   feat: padded   ", "leading or trailing whitespace"],
		["feat: ends with a period.", "must not end with a period"],
		["Initial commit", "must match conventional commits"],
		["wip: not a release type", "must match conventional commits"],
		["feat:", "must match conventional commits"],
		["feat(CORE): uppercase scope", "must match conventional commits"],
		["feat(): empty scope", "must match conventional commits"],
		["fixup! feat: squash me", "must match conventional commits"],
	])("rejects %j", (subject, reasonPart) => {
		const result = validateSubject(subject);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.reason).toContain(reasonPart);
		}
	});

	it("lists every release-it type in the error", () => {
		const result = validateSubject("nope");
		expect(result.ok).toBe(false);
		if (!result.ok) {
			for (const type of releaseTypes) {
				expect(result.reason).toContain(type);
			}
		}
	});

	it("formatError shows the subject and examples", () => {
		const text = formatError("Nope", "must match conventional commits");
		expect(text).toContain("Invalid commit subject");
		expect(text).toContain("Nope");
		expect(text).toContain("DEVELOPMENT.md");
	});
});
