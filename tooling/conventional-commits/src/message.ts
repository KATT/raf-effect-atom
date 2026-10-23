import { formatError, validateSubject } from "./validate.ts";

/**
 * The only places a `#N` may stand: `Refs: #1`, `Fixes #2, #3`. GitHub's
 * closing keywords count too.
 */
const referenceFooter =
	/^(?:refs|fix(?:e[sd])?|close[sd]?|resolve[sd]?):? +#\d+(?:,? +#\d+)*$/i;
const trailer = /^(?:co-authored-by|signed-off-by): \S/i;
/** conventional-commits-parser's note pattern: case-insensitive, `* ` allowed. */
const breakingFooter = /^(?:\*\s+)?BREAKING[ -]CHANGE:\s*(.*)$/i;
const trailingPullRequest = / \(#\d+\)$/;

/**
 * What the changelog links as an issue of this repo: `#` and a word, with an
 * optional `repo` right before it (`Atom#get` links issue `get` of
 * `KATT/Atom`). Code spans and URLs are left alone, as the changelog does.
 */
const protectedSegment = /(`+)[^\n]*?\1|https?:\/\/(?:[^\s()]|\([^\s()]*\))+/g;
const reference = /([\w./-]*)#[a-z0-9][\w-]*/gi;
/** `KATT/raf-query#222` links that repo's issue, which is what it means. */
const otherRepository = /^[\w.-]+\/[\w.-]+$/;

function strayReferences(text: string): ReadonlyArray<string> {
	return Array.from(text.replaceAll(protectedSegment, " ").matchAll(reference))
		.filter(([, repository = ""]) => !otherRepository.test(repository))
		.map(([raw]) => raw);
}

function quote(line: string): string {
	return JSON.stringify(line.length > 60 ? `${line.slice(0, 57)}...` : line);
}

/**
 * What release-it's changelog parser (conventional-commits-parser, read by
 * the conventionalcommits preset) would get wrong in a commit message:
 *
 * - a `#N` outside a `Refs:` / `Fixes:` footer and the subject's trailing
 *   `(#N)`, which it links as an issue of this repo;
 * - a `BREAKING CHANGE:` footer followed by anything but footers. The parser
 *   reads every later line into the breaking change until one that looks like
 *   a footer (`word: text`), so a wrapped line is cut off when it starts with
 *   `word: `, and otherwise drags the body after it into the changelog.
 */
export function messageProblems(message: string): ReadonlyArray<string> {
	const [subject = "", ...body] = message.split("\n");
	const problems: Array<string> = [];
	for (const raw of strayReferences(subject.replace(trailingPullRequest, ""))) {
		problems.push(`the subject mentions ${JSON.stringify(raw)}`);
	}
	let breakingLine: number | undefined;
	let afterBreaking = false;
	for (const [index, line] of body.entries()) {
		const lineNumber = index + 2;
		const isReferenceFooter = referenceFooter.test(line);
		if (!isReferenceFooter) {
			for (const raw of strayReferences(line)) {
				problems.push(`line ${lineNumber} mentions ${JSON.stringify(raw)}`);
			}
		}
		const breaking = breakingFooter.exec(line);
		if (breaking !== null) {
			if ((breaking[1] ?? "").trim() === "") {
				problems.push(`line ${lineNumber} is an empty BREAKING CHANGE footer`);
			}
			breakingLine ??= lineNumber;
			continue;
		}
		if (
			breakingLine !== undefined &&
			!afterBreaking &&
			line.trim() !== "" &&
			!isReferenceFooter &&
			!trailer.test(line)
		) {
			afterBreaking = true;
			problems.push(
				`line ${lineNumber} (${quote(line)}) follows the BREAKING CHANGE footer on line ${breakingLine}`,
			);
		}
	}
	return problems;
}

function formatMessageError(
	subject: string,
	problems: ReadonlyArray<string>,
): string {
	return [
		`Invalid commit message: ${JSON.stringify(subject)}`,
		...problems.map((problem) => `- ${problem}`),
		"",
		'"#N" goes only in a "Refs: #N" or "Fixes: #N" footer or the subject\'s',
		'trailing "(#N)", and only for this repo\'s own issues and PRs: the',
		'changelog links every other "#N" as one. Write "issue 41", put it in',
		"backticks, or link the URL.",
		"",
		'"BREAKING CHANGE: ..." takes one line, in the last paragraph. Only',
		"Refs/Fixes/Closes/Resolves, Co-authored-by and Signed-off-by footers may",
		"follow it: the changelog reads the lines after it into the breaking",
		'change, and cuts it at the first line that starts with "word: ".',
		"",
		"release-it writes the changelog and the GitHub release from the message.",
		"See .github/DEVELOPMENT.md.",
	].join("\n");
}

/** The error to show for a commit message, or `undefined` when it passes. */
export function messageError(message: string): string | undefined {
	const subject = message.split("\n", 1)[0] ?? "";
	const result = validateSubject(subject);
	if (!result.ok) {
		return formatError(subject, result.reason);
	}
	const problems = messageProblems(message);
	return problems.length === 0
		? undefined
		: formatMessageError(subject, problems);
}

const scissors = /^# -+ >8 -+$/;
/** Git's own comment lines: `#` alone or followed by a space or tab. */
const gitComment = /^#(?:[ \t]|$)/;

/**
 * The message git will commit, from the file the `commit-msg` hook gets:
 * without git's comment lines and the diff `--verbose` adds below the
 * scissors line. A `#41 ...` line is kept: `git commit -m` keeps it too.
 */
export function messageFromFile(text: string): string {
	const lines = text.split("\n");
	const end = lines.findIndex((line) => scissors.test(line));
	const kept = (end === -1 ? lines : lines.slice(0, end)).filter(
		(line) => !gitComment.test(line),
	);
	while (kept[0] === "") {
		kept.shift();
	}
	while (kept.at(-1)?.trim() === "") {
		kept.pop();
	}
	return kept.join("\n");
}
