import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";

import { apiLinks, apiPages } from "./api-pages.ts";
import {
	type ApiExport,
	type ApiReference,
	readApiReference,
} from "./api-reference.ts";

const packagesDir = new URL("../../packages", import.meta.url).pathname;
const repoRoot = new URL("../..", import.meta.url).pathname;

// Read once: a program per package takes a few seconds to type-check.
const reference = await Effect.runPromise(
	readApiReference({ packagesDir, repoRoot }).pipe(
		Effect.provide(NodeServices.layer),
	),
);

describe("readApiReference", () => {
	it("documents every export of every published entrypoint", () => {
		// An export listed here has no JSDoc description: add one to its declaration.
		expect(reference.undocumented).toEqual([]);
	});

	it("reads every published package's entrypoints", () => {
		const specifiers = reference.entries.map((entry) => entry.specifier);
		expect(specifiers).toEqual(
			expect.arrayContaining(["effect-atom-boundary", "raf-effect-atom"]),
		);
		for (const entry of reference.entries) {
			const ids = entry.groups.flatMap((group) => [
				group.id,
				...group.exports.map((member) => member.id),
			]);
			expect({ entry: entry.specifier, ids: [...new Set(ids)] }).toEqual({
				entry: entry.specifier,
				ids,
			});
			expect(entry.groups.flatMap((group) => group.exports)).not.toEqual([]);
		}
	});

	it("writes signatures as a `.d.ts` file declares them, without JSDoc", () => {
		const exports = reference.entries.flatMap((entry) =>
			entry.groups.flatMap((group) => group.exports),
		);
		for (const member of exports) {
			expect({
				id: member.id,
				signatures: member.signatures.length,
			}).not.toEqual({ id: member.id, signatures: 0 });
			for (const signature of member.signatures) {
				expect(signature).not.toMatch(/^(?:export|declare|\/\*\*)/);
			}
		}
	});
});

function fake(name: string, path: string, line = 1): ApiExport {
	return {
		doc: {
			category: undefined,
			deprecated: undefined,
			description: `Does ${name}. More about it.`,
			examples: [],
			params: [],
			returns: undefined,
			see: [],
			since: undefined,
		},
		id: name,
		kind: "const",
		name,
		signatures: [`const ${name}: () => void;`],
		source: { line, path },
	};
}

const fixture: ApiReference = {
	entries: [
		{
			description: "The main entry.",
			groups: [
				{
					description: "",
					exports: [
						fake("Loader.ensure", "Loader.ts", 1),
						fake("Loader.make", "Loader.ts", 2),
					],
					id: "Loader",
					inEntry: false,
					namespace: {
						...fake("Loader", "Loader.ts", 0),
						kind: "namespace",
						signatures: [],
					},
					title: "Loader",
				},
				{
					description: "",
					exports: [fake("make", "Registry.ts")],
					id: "module-Registry",
					inEntry: false,
					namespace: undefined,
					title: "Registry",
				},
				{
					description: "",
					exports: [fake("useThing", "Hooks.ts")],
					id: "module-Hooks",
					inEntry: false,
					namespace: undefined,
					title: "Hooks",
				},
			],
			packageName: "pkg",
			sourcePath: "packages/pkg/src/index.ts",
			specifier: "pkg",
		},
		{
			description: "A subpath.",
			groups: [
				{
					description: "",
					exports: [fake("ensure", "Next.ts", 1), fake("useThing", "Hooks.ts")],
					id: "module-Next",
					inEntry: true,
					namespace: undefined,
					title: "Next",
				},
			],
			packageName: "pkg",
			sourcePath: "packages/pkg/src/Next.ts",
			specifier: "pkg/next",
		},
	],
	undocumented: [],
};

describe("apiLinks", () => {
	const links = apiLinks(fixture);

	it("links an export and a namespace member by their names", () => {
		expect(links.get("Loader")).toBe("/docs/api-pkg#Loader");
		expect(links.get("Loader.ensure")).toBe("/docs/api-pkg#Loader.ensure");
		expect(links.get("useThing")).toBe("/docs/api-pkg#useThing");
	});

	it("prefers the main entry's namespace member to a subpath's export", () => {
		expect(links.get("ensure")).toBe("/docs/api-pkg#Loader.ensure");
	});

	it("prefers an export by its name to a member by its short name", () => {
		expect(links.get("make")).toBe("/docs/api-pkg#make");
	});
});

describe("apiPages", () => {
	const pages = apiPages(fixture, apiLinks(fixture));

	it("makes an index and a page per entrypoint", () => {
		expect(pages.map((page) => [page.slug, page.title])).toEqual([
			["api", "API reference"],
			["api-pkg", "pkg"],
			["api-pkg-next", "pkg/next"],
		]);
	});

	it("gives each export a heading with its name as the anchor", () => {
		const markdown = pages[1]?.markdown ?? "";
		expect(markdown).toContain("## `Loader` {#Loader}");
		expect(markdown).toContain("### `Loader.ensure` {#Loader.ensure}");
		expect(markdown).toContain("```ts\nconst Loader.make: () => void;\n```");
	});

	it("puts what an entry file declares itself at the top level", () => {
		const markdown = pages[2]?.markdown ?? "";
		expect(markdown).toContain("## `ensure` {#ensure}");
		expect(markdown).not.toContain("## Next");
	});

	it("lists every export on the index, linked to its anchor", () => {
		expect(pages[0]?.markdown).toContain(
			"| [`Loader.ensure`](./api-pkg.md#Loader.ensure) | Does Loader.ensure. |",
		);
	});
});
