import * as Atom from "effect/reactivity/Atom";
import { describe, expect, it } from "tstyche";

import {
	type Loader,
	useAtomResult,
	useWaterfall,
	WaterfallDetection,
	type WaterfallMode,
} from "../src/index.ts";
import { counter, issue } from "../test/fixtures/issues.ts";

type IssueError = Atom.Failure<ReturnType<typeof issue>>;
type Issue = Atom.Success<ReturnType<typeof issue>>;

describe("useWaterfall", () => {
	it("returns the atom it was given", () => {
		expect(useWaterfall(issue(1))).type.toBe<ReturnType<typeof issue>>();
	});

	it("feeds useAtomResult the same types", () => {
		expect(useAtomResult(useWaterfall(issue(1)))).type.toBe<
			Loader.SettledResult<Issue, IssueError>
		>();
	});

	it("takes only AsyncResult atoms", () => {
		expect(useWaterfall).type.toBeCallableWith(counter);
		expect(useWaterfall).type.not.toBeCallableWith(Atom.make(1));
	});
});

describe("WaterfallDetection", () => {
	it("takes the three modes", () => {
		expect<WaterfallMode>().type.toBe<"off" | "throw" | "warn">();
		expect(WaterfallDetection).type.toBeCallableWith({ mode: "throw" });
		expect(WaterfallDetection).type.not.toBeCallableWith({ mode: "error" });
	});
});
