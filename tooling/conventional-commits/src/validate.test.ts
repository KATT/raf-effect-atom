import { describe, expect, it } from "@effect/vitest";

import { releaseTypes } from "./types.ts";
import { formatError, validateSubject } from "./validate.ts";

describe("validateSubject", () => {
	it.each([
		"feat: add loader verbs",
		"fix(raf-effect-atom)!: prefetch keeps the atom mounted",
		"feat!: rename the read hook",
		"docs(boundary): show the compile error for a misspelled tag",
		"ci: check commit subjects on push",
		"chore(release): effect-atom-boundary@0.1.0",
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
