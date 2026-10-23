import { type ReleaseType, releaseTypes } from "./types.ts";

interface ValidSubject {
	readonly breaking: boolean;
	readonly scope: string | undefined;
	readonly subject: string;
	readonly type: ReleaseType;
}

export type SubjectResult =
	| { readonly ok: true; readonly parsed: ValidSubject }
	| { readonly ok: false; readonly reason: string };

const typeAlternation = releaseTypes.join("|");

/** `type(scope)!: subject` — scope and `!` optional; subject is the rest. */
const pattern = new RegExp(
	`^(${typeAlternation})(?:\\(([a-z0-9][a-z0-9./-]*)\\))?(!)?: (.+)$`,
);

function isReleaseType(value: string): value is ReleaseType {
	for (const type of releaseTypes) {
		if (type === value) {
			return true;
		}
	}
	return false;
}

/**
 * Whether a commit subject (a message's first line) is a conventional commit
 * that release-it reads for the changelog and version bump.
 */
export function validateSubject(subject: string): SubjectResult {
	const trimmed = subject.trim();
	if (trimmed.length === 0) {
		return { ok: false, reason: "subject is empty" };
	}
	if (trimmed !== subject) {
		return {
			ok: false,
			reason: "subject has leading or trailing whitespace",
		};
	}
	if (trimmed.endsWith(".")) {
		return {
			ok: false,
			reason: "subject must not end with a period",
		};
	}

	const match = pattern.exec(trimmed);
	if (match === null) {
		return {
			ok: false,
			reason: `must match conventional commits: type(scope)!: description (types: ${releaseTypes.join(", ")})`,
		};
	}

	const typeText = match[1] ?? "";
	if (!isReleaseType(typeText)) {
		return {
			ok: false,
			reason: `unknown type ${JSON.stringify(typeText)}`,
		};
	}
	const description = match[4] ?? "";
	if (description.trim().length === 0) {
		return { ok: false, reason: "description is empty" };
	}

	return {
		ok: true,
		parsed: {
			breaking: match[3] === "!",
			scope: match[2],
			subject: description,
			type: typeText,
		},
	};
}

export function formatError(subject: string, reason: string): string {
	return [
		`Invalid commit subject: ${JSON.stringify(subject)}`,
		reason,
		"",
		"Examples:",
		"  feat(boundary): claim errors by tag",
		"  fix(raf-effect-atom)!: prefetch keeps the atom mounted",
		"  docs: describe the loader verbs",
		"  ci: check commit subjects on push",
		"",
		"Commits land on main as they are, and release-it reads their subjects",
		"for the changelog and version bump. See .github/DEVELOPMENT.md.",
	].join("\n");
}
