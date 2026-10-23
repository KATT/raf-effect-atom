import { NodeServices } from "@effect/platform-node";
import { assert, describe, it } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import { build } from "vite-plus";

import { check, NoSourceMaps } from "./check.ts";
import { forbiddenPackages } from "./workspace.ts";

/** Writes `files` (path → contents) under a scoped temp directory. */
const writeTree = Effect.fn("writeTree")(function* (
	files: Readonly<Record<string, string>>,
) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const root = yield* fs.realPath(yield* fs.makeTempDirectoryScoped());
	for (const [file, contents] of Object.entries(files)) {
		yield* fs.makeDirectory(path.join(root, path.dirname(file)), {
			recursive: true,
		});
		yield* fs.writeFileString(path.join(root, file), contents);
	}
	return root;
});

/** A client entry per case, and a contract that's safe to ship. */
const workspace = {
	"app/package.json": JSON.stringify({ name: "app" }),
	"app/src/contract-only.js": [
		'import { label } from "../../libs/contract/index.js";',
		"document.title = label;",
	].join("\n"),
	"app/src/leak.js": [
		'import { label } from "../../libs/contract/index.js";',
		'import { handle } from "../../libs/backend/index.js";',
		"document.title = handle(label);",
	].join("\n"),
	"app/src/unused-import.js": [
		'import { label } from "../../libs/contract/index.js";',
		'import { handle } from "../../libs/backend/index.js";',
		"document.title = label;",
		"if (false) handle(label);",
	].join("\n"),
	"libs/backend/index.js":
		"export const handle = (label) => `${label}, handled on the server`;",
	"libs/backend/package.json": JSON.stringify({ name: "@fixture/backend" }),
	"libs/contract/index.js": 'export const label = "Issues";',
	"libs/contract/package.json": JSON.stringify({ name: "@fixture/contract" }),
	"package.json": JSON.stringify({ name: "root" }),
	"pnpm-workspace.yaml": "packages:\n  - app\n  - libs/*\n",
};

/** Bundles `app/src/<entry>.js` for the browser, as an app's client build does. */
const buildClient = Effect.fn("buildClient")(function* (
	root: string,
	entry: string,
) {
	const path = yield* Path.Path;
	const outDir = path.join(root, "app", "dist", entry);
	yield* Effect.promise(() =>
		build({
			build: {
				emptyOutDir: true,
				outDir,
				rolldownOptions: {
					input: path.join(root, "app", "src", `${entry}.js`),
				},
				sourcemap: "hidden",
			},
			configFile: false,
			logLevel: "silent",
			root: path.join(root, "app"),
		}),
	);
	return outDir;
});

const backend = { dir: "libs/backend", name: "@fixture/backend" };

describe("check", () => {
	it.effect("reports a client build that bundles the backend", () =>
		Effect.gen(function* () {
			const root = yield* writeTree(workspace);
			const clientDir = yield* buildClient(root, "leak");
			const report = yield* check({ clientDir, forbidden: [backend], root });
			assert.deepStrictEqual(
				report.leaks.map((leak) => [leak.packageName, leak.source]),
				[["@fixture/backend", "../../../../libs/backend/index.js"]],
			);
		}).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
	);

	it.effect("passes a client build that only bundles the contract", () =>
		Effect.gen(function* () {
			const root = yield* writeTree(workspace);
			const clientDir = yield* buildClient(root, "contract-only");
			const report = yield* check({ clientDir, forbidden: [backend], root });
			assert.deepStrictEqual(report.leaks, []);
			assert.isAbove(report.chunks.length, 0);
		}).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
	);

	it.effect("passes an import whose code tree-shaking removed", () =>
		Effect.gen(function* () {
			const root = yield* writeTree(workspace);
			const clientDir = yield* buildClient(root, "unused-import");
			const report = yield* check({ clientDir, forbidden: [backend], root });
			assert.deepStrictEqual(report.leaks, []);
		}).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
	);

	it.effect(
		"matches Turbopack's project paths, map names and node_modules",
		() =>
			Effect.gen(function* () {
				const map = (sources: ReadonlyArray<string>) =>
					JSON.stringify({ mappings: "", sources, version: 3 });
				const root = yield* writeTree({
					"client/0x1f.js.map": map([
						"turbopack:///[project]/libs/backend/index.js",
					]),
					"client/a.js": "",
					"client/a.js.map": map([
						"turbopack:///[project]/libs/backend/index.js",
						"turbopack:///[project]/libs/contract/index.js",
					]),
					"client/b.js": "",
					"client/b.js.map": map([
						"../node_modules/.pnpm/server-lib@1.0.0/node_modules/server-lib/index.js",
					]),
					"client/c.js": "//# sourceMappingURL=0x1f.js.map\n",
					"client/runtime.js": "",
				});
				const report = yield* check({
					clientDir: `${root}/client`,
					forbidden: [backend, { dir: undefined, name: "server-lib" }],
					root,
				});
				assert.deepStrictEqual(
					report.leaks.map((leak) => [leak.chunk, leak.packageName]),
					[
						["c.js", "@fixture/backend"],
						["a.js", "@fixture/backend"],
						["b.js", "server-lib"],
					],
				);
				assert.deepStrictEqual(report.unmapped, ["runtime.js"]);
			}).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
	);

	it.effect("fails when the build has no source maps to read", () =>
		Effect.gen(function* () {
			const root = yield* writeTree({ "client/a.js": "" });
			const error = yield* check({
				clientDir: `${root}/client`,
				forbidden: [backend],
				root,
			}).pipe(Effect.flip);
			assert.instanceOf(error, NoSourceMaps);
		}).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
	);
});

describe("forbiddenPackages", () => {
	it.effect(
		"finds workspace packages' directories and leaves the rest to node_modules",
		() =>
			Effect.gen(function* () {
				const root = yield* writeTree(workspace);
				assert.deepStrictEqual(
					yield* forbiddenPackages(root, ["@fixture/backend", "server-lib"]),
					[backend, { dir: undefined, name: "server-lib" }],
				);
			}).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
	);
});
