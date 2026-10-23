import { describe, expect, it } from "@effect/vitest";

import {
	buildSearchIndex,
	loadSearchIndex,
	searchDocs,
	type SearchPage,
} from "./docs-index.ts";

const pages: ReadonlyArray<SearchPage> = [
	{
		description:
			"AtomErrorBoundary catches an atom's typed failures by tag and renders a handler.",
		headings: [
			{ id: "one-boundary-for-one-atom", text: "One boundary for one atom" },
			{
				id: "what-a-boundary-doesnt-catch",
				text: "What a boundary doesn't catch",
			},
		],
		section: "Boundaries",
		sections: [
			{ id: undefined, text: "A boundary renders the handler for a tag." },
			{
				id: "one-boundary-for-one-atom",
				text: "The read under it reads the claimed atom.",
			},
			{
				id: "what-a-boundary-doesnt-catch",
				text: "A defect or an interruption goes to the app's own error component.",
			},
		],
		slug: "error-boundaries",
		title: "Error boundaries",
	},
	{
		description: "prefetch, ensure and fetch start atoms from route loaders.",
		headings: [{ id: "leases", text: "Leases" }],
		section: "Loaders",
		sections: [
			{ id: undefined, text: "Loaders start atoms before the route renders." },
			{
				id: "leases",
				text: "Every verb takes a lease until a component mounts.",
			},
		],
		slug: "loader-verbs",
		title: "Loader verbs",
	},
	{
		description: "The server streams each atom's result to the browser.",
		headings: [{ id: "serialization-keys", text: "Serialization keys" }],
		section: "Loaders",
		sections: [
			{
				id: undefined,
				text: "Hydration seeds an atom's value from the dehydrated state.",
			},
			{ id: "serialization-keys", text: "Each atom needs a serializationKey." },
		],
		slug: "hydration",
		title: "Streaming and hydration",
	},
	{
		description: "Start every atom before awaiting any.",
		headings: [
			{
				id: "render-time-inputs-usewaterfall",
				text: "Render-time inputs: useWaterfall",
			},
		],
		section: "Guides",
		sections: [
			{
				id: undefined,
				text: "A component that starts its data where it's used.",
			},
			{
				id: "render-time-inputs-usewaterfall",
				text: "useWaterfall reports reads that start one by one.",
			},
		],
		slug: "request-waterfalls",
		title: "Request waterfalls",
	},
	{
		description:
			"useAtomResult reads an atom a loader started and returns its typed failures.",
		headings: [{ id: "failures", text: "Failures" }],
		section: "Reading",
		sections: [
			{
				id: undefined,
				text: "Read the atom a boundary's claims wrap to send it to the boundary. A boundary resets it.",
			},
			{
				id: "failures",
				text: "An RpcClientError reaches the app boundary.",
			},
		],
		slug: "reading-atoms",
		title: "Reading atoms",
	},
];

const index = loadSearchIndex(buildSearchIndex(pages));

function ids(query: string) {
	return searchDocs(index, query).map((hit) => hit.id);
}

describe("searchDocs", () => {
	it("finds pages and headings with a typo", () => {
		expect(ids("boundry")[0]).toBe("error-boundaries");
		expect(ids("hydartion")[0]).toBe("hydration");
		expect(ids("watrefall")[0]).toBe("request-waterfalls");
		expect(ids("erorr")[0]).toBe("error-boundaries");
		expect(ids("laoder verbs")[0]).toBe("loader-verbs");
	});

	it("finds a word from its start, as it's typed", () => {
		expect(ids("hydr")[0]).toBe("hydration");
		expect(ids("serializ")[0]).toBe("hydration#serialization-keys");
	});

	it("matches other forms of a word", () => {
		expect(ids("boundaries")[0]).toBe("error-boundaries");
		expect(ids("hydrating")[0]).toBe("hydration");
		expect(ids("failure")).toContain("reading-atoms#failures");
	});

	it("finds a page by a synonym it never uses", () => {
		expect(ids("ssr")[0]).toBe("hydration");
		expect(ids("server rendering")[0]).toBe("hydration");
		expect(ids("preload")[0]).toBe("loader-verbs");
		expect(ids("sequential")[0]).toBe("request-waterfalls");
		expect(ids("cookie")).toContain("hydration");
		expect(ids("exception")).toEqual(
			expect.arrayContaining(["error-boundaries", "reading-atoms#failures"]),
		);
	});

	it("finds API names whole, by part, and from concepts", () => {
		expect(ids("useAtomResult")[0]).toBe("reading-atoms");
		expect(ids("use atom result")[0]).toBe("reading-atoms");
		expect(ids("useatomres")[0]).toBe("reading-atoms");
		expect(ids("client error")[0]).toBe("reading-atoms#failures");
		expect(ids("usewaterfall")[0]).toBe(
			"request-waterfalls#render-time-inputs-usewaterfall",
		);
	});

	it("ranks titles and headings above body text", () => {
		const hits = ids("boundary");
		expect(hits[0]).toBe("error-boundaries");
		expect(hits.indexOf("reading-atoms")).toBeGreaterThan(
			hits.indexOf("error-boundaries#what-a-boundary-doesnt-catch"),
		);
	});

	it("ranks the word typed above its synonyms", () => {
		expect(ids("catch")[0]).toBe(
			"error-boundaries#what-a-boundary-doesnt-catch",
		);
		expect(ids("prefetch")[0]).toBe("loader-verbs");
	});

	it("needs every word, unless no hit has them all", () => {
		expect(ids("boundary handler")[0]).toBe("error-boundaries");
		expect(ids("lease zzzzzz")[0]).toBe("loader-verbs#leases");
		expect(ids("the")).toEqual([]);
	});
});
