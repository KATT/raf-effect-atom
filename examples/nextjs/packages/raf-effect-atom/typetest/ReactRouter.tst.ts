import { hole } from "effect";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type * as EffectHydration from "effect/reactivity/Hydration";
import {
	createContext,
	type LoaderFunctionArgs,
	type MiddlewareFunction,
	useLoaderData,
} from "react-router";
import { describe, expect, it } from "tstyche";

import type { Handle, LoadedHandle } from "../src/index.ts";
import { atomsMiddleware, type RequestAtoms } from "../src/ReactRouter.ts";
import { counter, issue } from "../test/fixtures/issues.ts";

const atomsContext = createContext<RequestAtoms>();

const handlesLoader = async () => ({
	counter: hole<Handle<typeof counter>>(),
	issue: hole<LoadedHandle<typeof issue>>(),
});

describe("raf-effect-atom/react-router", () => {
	it("makes a React Router middleware from react-router's context", () => {
		expect(atomsMiddleware(atomsContext)).type.toBeAssignableTo<
			MiddlewareFunction<Response>
		>();
		expect(atomsMiddleware).type.not.toBeCallableWith(createContext<number>());
	});

	it("seeds each request's registry from the request", () => {
		expect(
			atomsMiddleware(atomsContext, {
				seed: async (registry, request) => {
					expect(registry).type.toBe<AtomRegistry.AtomRegistry>();
					expect(request).type.toBe<Request>();
				},
			}),
		).type.toBeAssignableTo<MiddlewareFunction<Response>>();
	});

	it("gives loaders the request's verbs and dehydrate", async () => {
		const args = hole<LoaderFunctionArgs>();
		const atoms = args.context.get(atomsContext);
		expect(await atoms.ensure(issue, 1)).type.toBe<
			LoadedHandle<typeof issue>
		>();
		expect(atoms.dehydrate()).type.toBe<
			Array<EffectHydration.DehydratedAtom>
		>();
	});

	it("keeps a handle's type through the loader data's serialization", () => {
		const data = useLoaderData<typeof handlesLoader>();
		expect(data.issue).type.toBeAssignableTo<LoadedHandle<typeof issue>>();
		expect(data.counter).type.toBeAssignableTo<Handle<typeof counter>>();
		expect(data.issue).type.not.toBeAssignableTo<
			Handle<(id: number) => Atom.Atom<AsyncResult.AsyncResult<string>>>
		>();
	});
});
