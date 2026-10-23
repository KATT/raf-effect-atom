import { describe, expect, it } from "@effect/vitest";
import createPreset from "conventional-changelog-conventionalcommits";
import { CommitParser, type ParserOptions } from "conventional-commits-parser";

import { messageError, messageFromFile, messageProblems } from "./message.ts";

// The preset's types declare `{}`; it returns `{ parser, writer, ... }`.
const preset: { readonly parser?: ParserOptions } = createPreset();
const parser = new CommitParser(preset.parser);

/** raf-effect-atom 0.2.0's breaking change, cut off at `promise: write`. */
const wrappedBreakingChange = [
	"feat(raf-effect-atom)!: seed each request registry, async seeds included",
	"",
	"BREAKING CHANGE: `dehydrate()` from `raf-effect-atom/next` returns a",
	"promise: write `<HydrateAtoms state={await dehydrate()}>`.",
	"",
	"A request registry can now be prepared from the request.",
].join("\n");

const accepted = [
	"feat: add loader verbs",
	"fix(raf-effect-atom): wait for the stream (#12)",
	"feat: one\n\nWhy it changed.\n\nRefs: #1",
	"fix: one\n\nBody.\n\nFixes #2, #3\nCloses: #4",
	"docs: two\n\nThe example's `#41` issue page, and https://github.com/KATT/raf-effect-atom/pull/1#top.",
	"feat: three\n\nThe duplicate request raf-query hit (KATT/raf-query#222) doesn't happen here.",
	"feat: four\n\nC# and a # heading are no references.",
	"feat!: five\n\nWhy.\n\nBREAKING CHANGE: `dehydrate()` from `raf-effect-atom/next` returns a promise.",
	"feat!: six\n\nWhy.\n\nBREAKING CHANGE: one line.\nRefs: #1\nCo-authored-by: A <a@example.com>",
	"feat!: seven\n\nBREAKING-CHANGE: one line.\n\nSigned-off-by: A <a@example.com>",
];

describe("messageProblems", () => {
	it.each(accepted)("accepts %j", (message) => {
		expect(messageProblems(message)).toEqual([]);
	});

	it.each([
		[
			"feat: run loaders in the browser\n\nThe second visit to #41 shows the issue.",
			'line 3 mentions "#41"',
		],
		[
			"fix(effect-atom-boundary): render handlers\n\nAny handler threw React error #321 (invalid hook call).",
			'line 3 mentions "#321"',
		],
		[
			"feat: boundaries\n\nthe duplicate request raf-query hit (#222, #223) doesn't happen",
			'line 3 mentions "#222"',
		],
		["feat: x\n\n#41 adds only modulepreload links", 'line 3 mentions "#41"'],
		["feat: x\n\nRead it with Atom#get.", 'line 3 mentions "Atom#get"'],
		["feat: x\n\nRefs: #1 and #41's page", 'line 3 mentions "#1"'],
		["fix: show #41 again", 'the subject mentions "#41"'],
		["fix: show #41 again (#2)", 'the subject mentions "#41"'],
		[
			wrappedBreakingChange,
			'line 4 ("promise: write `<HydrateAtoms state={await dehydrate()}>`.") follows the BREAKING CHANGE footer on line 3',
		],
		[
			"feat!: x\n\nBREAKING CHANGE: `a` is gone. Read\n`b` instead.",
			'line 4 ("`b` instead.") follows the BREAKING CHANGE footer on line 3',
		],
		[
			"feat!: x\n\nBREAKING CHANGE: `a` is gone.\n\nThe body after it.",
			'line 5 ("The body after it.") follows the BREAKING CHANGE footer on line 3',
		],
		[
			"feat!: x\n\nbreaking change: lower case counts\nwraps",
			'line 4 ("wraps") follows the BREAKING CHANGE footer on line 3',
		],
		[
			"feat!: x\n\nBREAKING CHANGE:",
			"line 3 is an empty BREAKING CHANGE footer",
		],
	])("rejects %j", (message, problem) => {
		expect(messageProblems(message)).toContainEqual(
			expect.stringContaining(problem),
		);
	});

	it("reports one problem for the lines after a BREAKING CHANGE footer", () => {
		expect(messageProblems(wrappedBreakingChange)).toHaveLength(1);
	});
});

describe("the changelog's parser", () => {
	it("is set up by the conventionalcommits preset", () => {
		expect(preset.parser?.breakingHeaderPattern).toBeInstanceOf(RegExp);
	});

	it("cuts a wrapped BREAKING CHANGE footer at a line like `word: text`", () => {
		expect(parser.parse(wrappedBreakingChange).notes).toEqual([
			{
				text: "`dehydrate()` from `raf-effect-atom/next` returns a",
				title: "BREAKING CHANGE",
			},
		]);
	});

	it("links every #N in a body as an issue of this repo", () => {
		expect(
			parser
				.parse("feat: x\n\nThe second visit to #41 shows the issue.")
				.references.map((reference) => reference.issue),
		).toEqual(["41"]);
	});

	it.each(accepted)(
		"reads %j's breaking change and references as written",
		(message) => {
			const commit = parser.parse(message);
			const breaking = message
				.split("\n")
				.flatMap((line) => /^BREAKING[ -]CHANGE: (.*)$/.exec(line)?.[1] ?? []);
			expect(commit.notes.map((note) => note.text)).toEqual(breaking);
			const written = [
				...message.matchAll(/^(?:Refs|Fixes|Closes):? (.*)$/gm),
				...message.matchAll(/ \((#\d+)\)$/gm),
			].flatMap(([, list = ""]) =>
				Array.from(list.matchAll(/#(\d+)/g), ([, issue]) => issue),
			);
			expect(
				commit.references
					.filter((reference) => reference.owner === null)
					.map((reference) => reference.issue)
					.toSorted(),
			).toEqual(written.toSorted());
		},
	);
});

describe("messageError", () => {
	it("passes a valid message", () => {
		expect(messageError("feat: x\n\nRefs: #1")).toBeUndefined();
	});

	it("shows the subject's error first", () => {
		expect(messageError("Update stuff\n\nSee #41.")).toContain(
			"Invalid commit subject",
		);
	});

	it("lists the body's problems with the rules", () => {
		const error = messageError(wrappedBreakingChange) ?? "";
		expect(error).toContain("Invalid commit message");
		expect(error).toContain("follows the BREAKING CHANGE footer on line 3");
		expect(error).toContain("DEVELOPMENT.md");
	});
});

describe("messageFromFile", () => {
	it("drops git's comments and the diff below the scissors line", () => {
		expect(
			messageFromFile(
				[
					"",
					"feat: x",
					"",
					"#41 is kept: git commit -m keeps it.",
					"# Please enter the commit message for your changes.",
					"#",
					"#\tmodified:   a.ts",
					"# ------------------------ >8 ------------------------",
					"diff --git a/a.ts b/a.ts",
					"+// see #41",
					"",
				].join("\n"),
			),
		).toBe("feat: x\n\n#41 is kept: git commit -m keeps it.");
	});
});
