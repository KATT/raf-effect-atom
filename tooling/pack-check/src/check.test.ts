import { assert, describe, it } from "@effect/vitest";

import {
	builtFile,
	isClientModule,
	type Manifest,
	reactServerTargets,
	specifiers,
	type Tarball,
	tarballProblems,
} from "./check.ts";

const manifest: Manifest = {
	exports: { ".": "./dist/index.mjs", "./rsc": "./dist/rsc.mjs" },
	name: "lib",
	peerDependencies: { effect: "^4.0.6" },
	version: "1.0.0",
};

const files = [
	"LICENSE",
	"README.md",
	"dist/use-atom-result.mjs",
	"dist/rsc.d.mts",
	"dist/rsc.mjs",
	"dist/index.d.mts",
	"dist/index.mjs",
	"package.json",
];

const tarball = (overrides: Partial<Tarball> = {}): Tarball => ({
	clientModules: new Set(["dist/use-atom-result.mjs"]),
	files,
	manifest,
	...overrides,
});

describe("tarballProblems", () => {
	it("passes a complete tarball", () => {
		assert.deepStrictEqual(
			tarballProblems(tarball(), ["src/use-atom-result.ts"]),
			[],
		);
	});

	it("reports a missing LICENSE", () => {
		assert.deepStrictEqual(
			tarballProblems(
				tarball({ files: files.filter((file) => file !== "LICENSE") }),
				[],
			),
			["LICENSE is missing from the tarball."],
		);
	});

	it("reports workspace and catalog specifiers left in", () => {
		assert.deepStrictEqual(
			tarballProblems(
				tarball({
					manifest: {
						...manifest,
						dependencies: { a: "workspace:*" },
						peerDependencies: { effect: "catalog:" },
					},
				}),
				[],
			),
			[
				'dependencies.a is "workspace:*", which only resolves inside this workspace.',
				'peerDependencies.effect is "catalog:", which only resolves inside this workspace.',
			],
		);
	});

	it("reports exports still pointing at src, or at missing files", () => {
		assert.deepStrictEqual(
			tarballProblems(
				tarball({
					manifest: {
						...manifest,
						exports: {
							".": "./src/index.ts",
							"./gone": { default: "./dist/gone.mjs" },
							"./rsc": "./dist/rsc.mjs",
						},
					},
				}),
				[],
			),
			[
				"exports points at ./src/index.ts, outside dist/: publishConfig.exports wasn't applied.",
				"exports points at ./dist/gone.mjs, which isn't in the tarball.",
			],
		);
	});

	it("reports an entry without declarations", () => {
		assert.deepStrictEqual(
			tarballProblems(
				tarball({ files: files.filter((file) => file !== "dist/rsc.d.mts") }),
				[],
			),
			["./dist/rsc.mjs has no type declarations next to it (.d.mts)."],
		);
	});

	it('reports a client module that lost "use client"', () => {
		assert.deepStrictEqual(
			tarballProblems(tarball({ clientModules: new Set() }), [
				"src/use-atom-result.ts",
				"src/gone.tsx",
			]),
			[
				'src/use-atom-result.ts starts with "use client" but dist/use-atom-result.mjs lost the directive.',
				'src/gone.tsx starts with "use client" but dist/gone.mjs isn\'t in the tarball.',
			],
		);
	});
});

describe("reactServerTargets", () => {
	it("names each subpath with a react-server condition, and its target", () => {
		assert.deepStrictEqual(
			reactServerTargets({
				...manifest,
				exports: {
					".": {
						default: "./dist/index.mjs",
						"react-server": "./dist/index-react-server.mjs",
					},
					"./rsc": "./dist/rsc.mjs",
				},
			}),
			[{ specifier: "lib", target: "./dist/index-react-server.mjs" }],
		);
	});

	it("names none without the condition", () => {
		assert.deepStrictEqual(reactServerTargets(manifest), []);
	});
});

describe("specifiers", () => {
	it("names each subpath export", () => {
		assert.deepStrictEqual(specifiers(manifest), ["lib", "lib/rsc"]);
	});

	it("names the package when exports is a single target", () => {
		assert.deepStrictEqual(
			specifiers({ ...manifest, exports: "./dist/index.mjs" }),
			["lib"],
		);
	});
});

describe("builtFile", () => {
	it("maps a source file to its unbundled output", () => {
		assert.strictEqual(builtFile("src/internal/a.tsx"), "dist/internal/a.mjs");
	});
});

describe("isClientModule", () => {
	it("finds the directive as the first statement, after comments", () => {
		assert.isTrue(isClientModule('"use client";\nimport "react";'));
		assert.isTrue(isClientModule("\n'use client'\n"));
		assert.isTrue(
			isClientModule('/**\n * Hooks.\n */\n// note\n"use client";\n'),
		);
		assert.isFalse(isClientModule('import "react";\n"use client";'));
	});
});
