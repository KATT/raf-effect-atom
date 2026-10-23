import {
	Comment,
	CommentId,
	Issue,
	IssueId,
	type IssueStatus,
	User,
	UserId,
} from "@examples/contract";
import { DateTime } from "effect";

/** The issue tracker's tables. Mutated in place by `Issues`. */
export interface Store {
	readonly comments: Array<Comment>;
	readonly issues: Map<IssueId, Issue>;
	readonly users: Map<UserId, User>;
}

/** Who the example apps are signed in as. */
export const exampleUser = new User({
	id: UserId.make("ada"),
	name: "Ada Lovelace",
	title: "Analyst",
});

const users: ReadonlyArray<User> = [
	exampleUser,
	new User({
		id: UserId.make("grace"),
		name: "Grace Hopper",
		title: "Compiler engineer",
	}),
	new User({
		id: UserId.make("alan"),
		name: "Alan Turing",
		title: "Researcher",
	}),
	new User({
		id: UserId.make("katherine"),
		name: "Katherine Johnson",
		title: "Mathematician",
	}),
	new User({
		id: UserId.make("linus"),
		name: "Linus Torvalds",
		title: "Kernel maintainer",
	}),
];

const subjects = [
	"Login form",
	"Search results",
	"Settings page",
	"Billing export",
	"Notification email",
	"Dark mode",
	"Avatar upload",
	"Keyboard shortcuts",
	"Onboarding checklist",
	"Audit log",
];

const problems = [
	"loses input on refresh",
	"is slow with 1000+ rows",
	"ignores the user's locale",
	"flickers when switching tabs",
	"shows a stale count",
	"needs an empty state",
	"breaks on narrow screens",
];

const replies = [
	"I can reproduce this on main.",
	"Looks like a caching issue to me.",
	"Could we add a test for this first?",
	"Fixed in my branch, opening a PR soon.",
	"This also happens on mobile.",
	"Bumping the priority, a customer hit it today.",
	"Is this related to the last release?",
	"Confirmed, closing once the fix ships.",
];

const statuses: ReadonlyArray<IssueStatus> = ["open", "in_progress", "closed"];

/** Small deterministic PRNG, so every server start sees the same data. */
function random(seedValue: number) {
	let state = seedValue;
	return () => {
		state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
		return state / 2_147_483_648;
	};
}

function pick<T>(next: () => number, items: ReadonlyArray<T>): T {
	const item = items[Math.floor(next() * items.length)];
	if (item === undefined) {
		throw new Error("pick: empty list");
	}
	return item;
}

/** A v4 UUID that reads as the seed comment's number. */
const seedCommentId = (n: number) =>
	CommentId.make(`00000000-0000-4000-8000-${String(n).padStart(12, "0")}`);

/** 42 issues and their comments, the same on every call. */
export function seed(): Store {
	const next = random(42);
	const start = DateTime.makeUnsafe("2026-01-05T00:00:00Z");
	const issues = new Map<IssueId, Issue>();
	const comments: Array<Comment> = [];

	for (let n = 1; n <= 42; n++) {
		const id = IssueId.make(n);
		const createdAt = DateTime.add(start, {
			days: n * 2,
			milliseconds: Math.floor(next() * 86_400_000),
		});
		const commentCount = Math.floor(next() * 11);
		for (let index = 0; index < commentCount; index++) {
			comments.push(
				new Comment({
					author: pick(next, users),
					body: pick(next, replies),
					createdAt: DateTime.add(createdAt, { hours: index + 1 }),
					id: seedCommentId(comments.length + 1),
					issueId: id,
				}),
			);
		}
		issues.set(
			id,
			new Issue({
				assigneeId: pick(next, users).id,
				body: `Steps to reproduce:\n\n1. Open the ${pick(next, subjects).toLowerCase()}.\n2. Wait a moment.\n3. Observe the problem.`,
				commentCount,
				createdAt,
				id,
				status: pick(next, statuses),
				title: `${pick(next, subjects)} ${pick(next, problems)}`,
			}),
		);
	}

	return {
		comments,
		issues,
		users: new Map(users.map((user) => [user.id, user])),
	};
}
