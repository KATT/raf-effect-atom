import { hole } from "effect";
import type * as Atom from "effect/reactivity/Atom";
import type * as EffectHydration from "effect/reactivity/Hydration";
import {
	createContext,
	type LoaderFunctionArgs,
	type MiddlewareFunction,
} from "react-router";
import { describe, expect, it } from "tstyche";

import type { Loader } from "../src/index.ts";
import { atomsMiddleware, type RequestAtoms } from "../src/ReactRouter.ts";
import { issue } from "../test/fixtures/issues.ts";

type IssueError = Atom.Failure<ReturnType<typeof issue>>;
type Issue = Atom.Success<ReturnType<typeof issue>>;

const atomsContext = createContext<RequestAtoms>();

describe("raf-effect-atom/react-router", () => {
	it("makes a React Router middleware from react-router's context", () => {
		expect(atomsMiddleware(atomsContext)).type.toBeAssignableTo<
			MiddlewareFunction<Response>
		>();
		expect(atomsMiddleware).type.not.toBeCallableWith(createContext<number>());
	});

	it("gives loaders the request's verbs and dehydrate", async () => {
		const args = hole<LoaderFunctionArgs>();
		const atoms = args.context.get(atomsContext);
		expect(await atoms.ensure(issue(1))).type.toBe<
			Loader.SettledResult<Issue, IssueError>
		>();
		expect(atoms.dehydrate()).type.toBe<
			Array<EffectHydration.DehydratedAtom>
		>();
	});
});
