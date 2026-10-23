import { assert, describe, it } from "@effect/vitest";

import {
	builtFile,
	isClientModule,
	type Manifest,
	specifiers,
	type Tarball,
	tarballProblems,
} from "./check.ts";

const manifest: Manifest = {
	exports: { ".": "./dist/index.mjs", "./next": "./dist/Next.mjs" },
	name: "lib",
	peerDependencies: { effect: "^4.0.6" },
	version: "1.0.0",
};

const files = [
	"LICENSE",
	"README.md",
	"dist/Hooks.mjs",
	"dist/Next.d.mts",
	"dist/Next.mjs",
	"dist/index.d.mts",
	"dist/index.mjs",
	"package.json",
];

const tarball = (overrides: Partial<Tarball> = {}): Tarball => ({
	clientModules: new Set(["dist/Hooks.mjs"]),
	files,
	manifest,
	...overrides,
});

describe("tarballProblems", () => {
	it("passes a complete tarball", () => {
		assert.deepStrictEqual(tarballProblems(tarball(), ["src/Hooks.ts"]), []);
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
							"./gone": { default: "./dist/Gone.mjs" },
							"./next": "./dist/Next.mjs",
						},
					},
				}),
				[],
			),
			[
				"exports points at ./src/index.ts, outside dist/: publishConfig.exports wasn't applied.",
				"exports points at ./dist/Gone.mjs, which isn't in the tarball.",
			],
		);
	});

	it("reports an entry without declarations", () => {
		assert.deepStrictEqual(
			tarballProblems(
				tarball({ files: files.filter((file) => file !== "dist/Next.d.mts") }),
				[],
			),
			["./dist/Next.mjs has no type declarations next to it (.d.mts)."],
		);
	});

	it('reports a client module that lost "use client"', () => {
		assert.deepStrictEqual(
			tarballProblems(tarball({ clientModules: new Set() }), [
				"src/Hooks.ts",
				"src/Gone.tsx",
			]),
			[
				'src/Hooks.ts starts with "use client" but dist/Hooks.mjs lost the directive.',
				'src/Gone.tsx starts with "use client" but dist/Gone.mjs isn\'t in the tarball.',
			],
		);
	});
});

describe("specifiers", () => {
	it("names each subpath export", () => {
		assert.deepStrictEqual(specifiers(manifest), ["lib", "lib/next"]);
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
