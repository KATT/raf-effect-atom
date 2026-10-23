import { NodeServices } from "@effect/platform-node";
import { assert, describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";

import {
	apps,
	devPort,
	isIgnored,
	openUrl,
	rewriteSharedPaths,
	rootPackageJson,
	standaloneReadme,
	standaloneWorkspaceYaml,
	writeCopies,
} from "./copies.ts";

const root = new URL("../../..", import.meta.url).pathname;

describe("isIgnored", () => {
	it("skips build output, dependencies, TypeScript build info and Vercel config", () => {
		assert.isTrue(isIgnored("node_modules/react/index.js", "/"));
		assert.isTrue(isIgnored("src/.next/cache", "/"));
		assert.isTrue(isIgnored("tsconfig.tsbuildinfo", "/"));
		assert.isTrue(isIgnored("vercel.json", "/"));
		assert.isFalse(isIgnored("src/app/page.tsx", "/"));
		assert.isFalse(isIgnored("src/dist-utils.ts", "/"));
	});
});

describe("rewriteSharedPaths", () => {
	it("points paths into examples/.shared at the copy's packages, one level further up", () => {
		assert.strictEqual(
			rewriteSharedPaths('@source "../../.shared/kit/src";'),
			'@source "../../../packages/kit/src";',
		);
		assert.strictEqual(
			rewriteSharedPaths('import "./shared/x";'),
			'import "./shared/x";',
		);
	});
});

describe("rootPackageJson", () => {
	it("runs the app's scripts from the workspace root, with the monorepo's pnpm", () => {
		expect(
			rootPackageJson(
				"nextjs",
				{
					name: "@examples/nextjs",
					scripts: { build: "next build", dev: "next dev", typecheck: "tsc" },
				},
				{
					engines: { node: ">=24" },
					name: "monorepo",
					packageManager: "pnpm@12.15.0",
					scripts: { lint: "vp lint" },
				},
			),
		).toEqual({
			engines: { node: ">=24" },
			name: "raf-effect-atom-nextjs-example",
			packageManager: "pnpm@12.15.0",
			private: true,
			scripts: {
				build: "pnpm --filter @examples/nextjs build",
				dev: "pnpm --filter @examples/nextjs dev",
				typecheck: "pnpm --filter @examples/nextjs typecheck",
			},
			type: "module",
			version: "0.0.0",
		});
	});
});

describe("standaloneWorkspaceYaml", () => {
	it("swaps the package list and keeps the rest", () => {
		assert.strictEqual(
			standaloneWorkspaceYaml(
				'packages:\n  - "examples/*"\n  - tooling/*\n\noverrides:\n  vite@*: npm:x@1.0.0\n',
			),
			"packages:\n  - apps/*\n  - packages/*\n\noverrides:\n  vite@*: npm:x@1.0.0\n",
		);
	});

	it.effect("keeps the monorepo's catalog and Vite+ override", () =>
		Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			const path = yield* Path.Path;
			const yaml = standaloneWorkspaceYaml(
				yield* fs.readFileString(path.join(root, "pnpm-workspace.yaml")),
			);
			expect(yaml).toContain("\ncatalog:\n");
			expect(yaml).toContain("vite@*: npm:@voidzero-dev/vite-plus-core@");
			expect(yaml).not.toContain("examples/");
		}).pipe(Effect.provide(NodeServices.layer)),
	);

	it("returns undefined without a leading `packages:` list", () => {
		assert.isUndefined(standaloneWorkspaceYaml("catalog:\n  effect: 4.0.6\n"));
	});
});

describe("devPort", () => {
	it("reads the dev script's --port", () => {
		assert.strictEqual(
			devPort({ name: "app", scripts: { dev: "next dev --port 3007" } }),
			3007,
		);
		assert.isUndefined(devPort({ name: "app", scripts: { dev: "next dev" } }));
	});
});

describe("openUrl", () => {
	it("opens the copy's folder on the codesandbox branch", () => {
		assert.strictEqual(
			openUrl("nextjs"),
			"https://codesandbox.io/p/devbox/github/KATT/raf-effect-atom/tree/codesandbox/examples/nextjs?file=/apps/nextjs/src/app/prefetch/issues/page.tsx",
		);
	});
});

describe("standaloneReadme", () => {
	it("notes the copy's origin and how to run it", () => {
		const readme = standaloneReadme(
			"nextjs",
			{ description: "The issue tracker on Next.js", name: "@examples/nextjs" },
			3007,
		);
		expect(readme).toMatch(
			/^# raf-effect-atom on the Next\.js App Router\n\n> A standalone copy of \[`examples\/nextjs`\]/,
		);
		expect(readme).toContain("The issue tracker on Next.js. It runs live");
		expect(readme).toContain(
			`## Run it\n\n[Open it in CodeSandbox](${openUrl("nextjs")}), or locally:\n\n\`\`\`shell\npnpm install\npnpm dev\n\`\`\`\n\nThen open <http://localhost:3007>.\n`,
		);
	});
});

describe("writeCopies", () => {
	it.effect("writes each app as its own pnpm workspace", () =>
		Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			const path = yield* Path.Path;
			const out = yield* fs.makeTempDirectoryScoped();
			yield* fs.makeDirectory(path.join(out, ".git"));
			yield* fs.writeFileString(path.join(out, ".git", "HEAD"), "kept");
			yield* fs.writeFileString(path.join(out, "stale.txt"), "removed");

			const targets = yield* writeCopies(root, out);

			assert.deepStrictEqual(
				targets,
				apps.map((app) => path.join(out, "examples", app)),
			);
			assert.strictEqual(
				yield* fs.readFileString(path.join(out, ".git", "HEAD")),
				"kept",
			);
			assert.isFalse(yield* fs.exists(path.join(out, "stale.txt")));
			expect(yield* fs.readFileString(path.join(out, "README.md"))).toContain(
				openUrl("nextjs"),
			);
			const noDeployments = { git: { deploymentEnabled: false } };
			const readJson = (file: string) =>
				fs.readFileString(file).pipe(Effect.map((text) => JSON.parse(text)));
			assert.deepStrictEqual(
				yield* readJson(path.join(out, "www", "vercel.json")),
				noDeployments,
			);

			const monorepo = yield* readJson(path.join(root, "package.json"));
			for (const [index, target] of targets.entries()) {
				const app = apps[index];
				const read = (file: string) =>
					fs.readFileString(path.join(target, file));
				const exists = (file: string) => fs.exists(path.join(target, file));
				const sourceFile = (file: string) =>
					fs.readFileString(path.join(root, "examples", `${app}`, file));

				assert.strictEqual(
					yield* read(`apps/${app}/package.json`),
					yield* sourceFile("package.json"),
				);
				const pkg = yield* readJson(
					path.join(target, `apps/${app}/package.json`),
				);
				for (const [name, dir] of [
					["raf-effect-atom", "packages/raf-effect-atom"],
					["effect-atom-boundary", "packages/effect-atom-boundary"],
					["@examples/ui", "examples/.shared/ui"],
					["@examples/db", "examples/.shared/db"],
					["@tooling/og-image", "tooling/og-image"],
					["@tooling/bundle-check", "tooling/bundle-check"],
				]) {
					const copied = yield* readJson(
						path.join(target, "packages", path.basename(dir), "package.json"),
					);
					assert.strictEqual(copied.name, name);
					assert.isFalse(
						yield* exists(
							path.join("packages", path.basename(dir), "node_modules"),
						),
					);
				}
				assert.isFalse(yield* exists("packages/vercel-ignore"));
				assert.isFalse(yield* exists(`apps/${app}/node_modules`));

				const rootPkg = yield* readJson(path.join(target, "package.json"));
				assert.strictEqual(
					rootPkg.scripts.dev,
					`pnpm --filter ${pkg.name} dev`,
				);
				assert.strictEqual(rootPkg.packageManager, monorepo.packageManager);
				expect(yield* read("pnpm-workspace.yaml")).toMatch(
					/^packages:\n {2}- apps\/\*\n {2}- packages\/\*\n/,
				);
				assert.deepStrictEqual(
					yield* readJson(path.join(target, "vercel.json")),
					noDeployments,
				);

				const port = devPort(pkg);
				const tasks = JSON.parse(yield* read(".codesandbox/tasks.json"));
				assert.deepStrictEqual(tasks.setupTasks, [
					{ command: "pnpm install", name: "Install dependencies" },
				]);
				assert.deepStrictEqual(tasks.tasks.dev.preview, { port });
				assert.isTrue(tasks.tasks.dev.runAtStart);
				const template = JSON.parse(yield* read(".codesandbox/template.json"));
				assert.strictEqual(template.description, pkg.description);
				expect(template.title).toMatch(/^raf-effect-atom on /);
				expect(
					JSON.parse(yield* read(".devcontainer/devcontainer.json")).image,
				).toMatch(/^ghcr\.io\/codesandbox\/devcontainers\/typescript-node:/);
				expect(yield* read("README.md")).toContain("pnpm install\npnpm dev\n");
			}

			const css = (app: string, file: string) =>
				fs.readFileString(path.join(out, "examples", app, "apps", app, file));
			expect(yield* css("tanstack-start", "src/styles.css")).toContain(
				'@source "../../../packages/kit/src";',
			);
			expect(yield* css("react-router", "app/app.css")).toContain(
				'@source "../../../packages/kit/src";',
			);
			expect(yield* css("nextjs", "src/app/globals.css")).toContain(
				'@source "../../../../packages/kit/src";',
			);
		}).pipe(Effect.provide(NodeServices.layer)),
	);
});
