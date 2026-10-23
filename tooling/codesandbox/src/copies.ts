/**
 * Standalone copies of the example apps, for CodeSandbox to open one folder
 * at a time. Each copy is its own pnpm workspace: the app in `apps/<app>`, and
 * every workspace package it depends on (the libraries, `examples/.shared/*`,
 * the build tools) copied as-is into `packages/`, so every `workspace:*`
 * dependency still resolves.
 */
import { dependencyDirs } from "@tooling/vercel-ignore/workspace";
import {
	Data,
	Effect,
	FileSystem,
	Path,
	type PlatformError,
	Schema,
} from "effect";

const repo = "KATT/raf-effect-atom";
export const branch = "codesandbox";
export const apps = ["tanstack-start", "nextjs", "react-router"] as const;
export type App = (typeof apps)[number];

const frameworks = {
	nextjs: "the Next.js App Router",
	"react-router": "React Router Framework Mode",
	"tanstack-start": "TanStack Start",
} satisfies Record<App, string>;

/** The route each app's CodeSandbox link opens, relative to the app. */
const routes = {
	nextjs: "src/app/prefetch/issues/page.tsx",
	"react-router": "app/routes/prefetch/issues.tsx",
	"tanstack-start": "src/routes/prefetch/issues/index.tsx",
} satisfies Record<App, string>;

const ignored = new Set([
	".DS_Store",
	".next",
	".output",
	".react-router",
	".tanstack",
	".vercel",
	"build",
	"coverage",
	"dist",
	"next-env.d.ts",
	"node_modules",
	"vercel.json",
]);

/** Files whose relative paths to `examples/.shared` are rewritten. */
const textFile = /\.(?:css|[cm]?[jt]sx?|json)$/;

const PackageJson = Schema.fromJsonString(
	Schema.Struct({
		description: Schema.optionalKey(Schema.String),
		engines: Schema.optionalKey(Schema.Record(Schema.String, Schema.String)),
		name: Schema.String,
		packageManager: Schema.optionalKey(Schema.String),
		scripts: Schema.optionalKey(Schema.Record(Schema.String, Schema.String)),
	}),
);
export type PackageJson = typeof PackageJson.Type;

class CopyError extends Data.TaggedError("CopyError")<{
	readonly message: string;
}> {}

export function isIgnored(file: string, separator: string) {
	return file
		.split(separator)
		.some((part) => ignored.has(part) || part.endsWith(".tsbuildinfo"));
}

/** The link that opens `app`'s copy on CodeSandbox, at its issue list route. */
export function openUrl(app: App) {
	return `https://codesandbox.io/p/devbox/github/${repo}/tree/${branch}/examples/${app}?file=/apps/${app}/${routes[app]}`;
}

/**
 * A file of the app with its relative paths into `examples/.shared/` pointed
 * at the copy's `packages/`, one directory further up: `apps/<app>` instead
 * of `examples/<app>`.
 */
export function rewriteSharedPaths(text: string) {
	return text.replaceAll("../.shared/", "../../packages/");
}

/**
 * The workspace root's `package.json`: runs the app's scripts from the root,
 * with the monorepo's pnpm and Node versions.
 */
export function rootPackageJson(
	app: App,
	pkg: PackageJson,
	monorepo: PackageJson,
) {
	return {
		engines: monorepo.engines,
		name: `raf-effect-atom-${app}-example`,
		packageManager: monorepo.packageManager,
		private: true,
		scripts: Object.fromEntries(
			Object.keys(pkg.scripts ?? {}).map((name) => [
				name,
				`pnpm --filter ${pkg.name} ${name}`,
			]),
		),
		type: "module",
		version: "0.0.0",
	};
}

/**
 * The monorepo's `pnpm-workspace.yaml` with the copy's packages, so the copy
 * keeps its catalog, overrides (`vite` is Vite+) and install settings.
 * `undefined` if it doesn't start with a `packages:` list.
 */
export function standaloneWorkspaceYaml(yaml: string) {
	const packages = /^packages:\n(?:[ \t]+- .*\n)+/;
	return packages.test(yaml)
		? yaml.replace(packages, "packages:\n  - apps/*\n  - packages/*\n")
		: undefined;
}

/** The port in the app's `dev` script (`--port <n>`). */
export function devPort(pkg: PackageJson) {
	const port = /--port (\d+)/.exec(pkg.scripts?.dev ?? "")?.[1];
	return port === undefined ? undefined : Number(port);
}

const title = (app: App) => `raf-effect-atom on ${frameworks[app]}`;

/** The copy's README: what it is, where it came from, and how to run it. */
export function standaloneReadme(app: App, pkg: PackageJson, port: number) {
	return [
		`# ${title(app)}`,
		"",
		`> A standalone copy of [\`examples/${app}\`](https://github.com/${repo}/tree/main/examples/${app}), generated for CodeSandbox from every push to \`main\`: edit the original, not this copy. The app is in \`apps/${app}\`; the libraries, and the UI, fake database and RPC backend it shares with the other examples, are in \`packages/\`.`,
		"",
		`${pkg.description ?? "An example app"}. It runs live at <https://${app}.raf-effect-atom.katt.dev>, and [the docs](https://raf-effect-atom.katt.dev/docs/examples) list what each screen shows.`,
		"",
		"## Run it",
		"",
		`[Open it in CodeSandbox](${openUrl(app)}), or locally:`,
		"",
		"```shell",
		"pnpm install",
		"pnpm dev",
		"```",
		"",
		`Then open <http://localhost:${port}>.`,
		"",
	].join("\n");
}

/** `.codesandbox/tasks.json`: install, then start the dev server. */
function tasksJson(port: number) {
	return {
		$schema: "https://codesandbox.io/schemas/tasks.json",
		setupTasks: [{ command: "pnpm install", name: "Install dependencies" }],
		tasks: {
			build: { command: "pnpm build", name: "Production build" },
			dev: {
				command: "pnpm dev",
				name: "Dev server",
				preview: { port },
				runAtStart: true,
			},
			typecheck: { command: "pnpm typecheck", name: "Type check" },
		},
	};
}

/** `.codesandbox/template.json`: the name CodeSandbox shows for the copy. */
function templateJson(app: App, pkg: PackageJson) {
	return { description: pkg.description, title: title(app) };
}

/**
 * `.devcontainer/devcontainer.json`. CodeSandbox's Node image, whose pnpm
 * switches itself to the root `packageManager`.
 */
function devcontainerJson(app: App) {
	return {
		image: "ghcr.io/codesandbox/devcontainers/typescript-node:24",
		name: `raf-effect-atom-${app}-example`,
	};
}

/**
 * The branch's Vercel config, in each Vercel project's root directory
 * (`www` and `examples/<app>`): the branch holds no project Vercel can build.
 */
const noDeployments = { git: { deploymentEnabled: false } };

const gitignore = [
	"node_modules",
	".DS_Store",
	".next",
	".output",
	".react-router",
	".tanstack",
	".vercel",
	"build",
	"coverage",
	"dist",
	"next-env.d.ts",
	"*.tsbuildinfo",
	"# Rendered by `example-og-image` before each build.",
	"/apps/*/public/og.png",
	"",
].join("\n");

const branchReadme = [
	"# raf-effect-atom examples for CodeSandbox",
	"",
	`Generated from [\`examples/\`](https://github.com/${repo}/tree/main/examples) by [\`tooling/codesandbox\`](https://github.com/${repo}/tree/main/tooling/codesandbox) after every push to \`main\` that changes them. Don't edit this branch: the next sync overwrites it.`,
	"",
	...apps.map(
		(app) =>
			`- [\`examples/${app}\`](./examples/${app}): [open in CodeSandbox](${openUrl(app)})`,
	),
	"",
].join("\n");

type JsonFile =
	| ReturnType<typeof devcontainerJson>
	| ReturnType<typeof rootPackageJson>
	| ReturnType<typeof tasksJson>
	| ReturnType<typeof templateJson>
	| typeof noDeployments;

const json = (value: JsonFile) => `${JSON.stringify(value, null, "\t")}\n`;

const readPackageJson = Effect.fn("readPackageJson")(function* (dir: string) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	return yield* Schema.decodeEffect(PackageJson)(
		yield* fs.readFileString(path.join(dir, "package.json")),
	);
});

/**
 * Replaces everything in `out` except `.git` with a workspace for each app, in
 * `out/examples/<app>`. Returns the workspaces' directories.
 */
export const writeCopies = Effect.fn("writeCopies")(function* (
	root: string,
	out: string,
) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;

	// Walks one level at a time so ignored directories (`node_modules` holds
	// tens of thousands of files) are never read.
	const copyTree: (
		from: string,
		to: string,
		rewrite: (text: string) => string,
	) => Effect.Effect<void, PlatformError.PlatformError> = Effect.fn("copyTree")(
		function* (from: string, to: string, rewrite: (text: string) => string) {
			for (const entry of yield* fs.readDirectory(from)) {
				if (isIgnored(entry, path.sep)) {
					continue;
				}
				const source = path.join(from, entry);
				const target = path.join(to, entry);
				const info = yield* fs.stat(source);
				if (info.type === "Directory") {
					yield* copyTree(source, target, rewrite);
				} else if (info.type === "File") {
					yield* fs.makeDirectory(to, { recursive: true });
					if (textFile.test(entry)) {
						yield* fs.writeFileString(
							target,
							rewrite(yield* fs.readFileString(source)),
						);
					} else {
						yield* fs.copyFile(source, target);
					}
				}
			}
		},
	);

	const monorepo = yield* readPackageJson(root);
	const workspaceYaml = standaloneWorkspaceYaml(
		yield* fs.readFileString(path.join(root, "pnpm-workspace.yaml")),
	);
	if (workspaceYaml === undefined) {
		return yield* new CopyError({
			message: "pnpm-workspace.yaml doesn't start with a `packages:` list",
		});
	}

	yield* fs.makeDirectory(out, { recursive: true });
	for (const entry of yield* fs.readDirectory(out)) {
		if (entry !== ".git") {
			yield* fs.remove(path.join(out, entry), { recursive: true });
		}
	}

	const targets: Array<string> = [];
	for (const app of apps) {
		const source = path.join("examples", app);
		const target = path.join(out, source);
		const write = (file: string, contents: string) =>
			fs
				.makeDirectory(path.dirname(path.join(target, file)), {
					recursive: true,
				})
				.pipe(
					Effect.andThen(fs.writeFileString(path.join(target, file), contents)),
				);
		targets.push(target);
		yield* copyTree(
			path.join(root, source),
			path.join(target, "apps", app),
			rewriteSharedPaths,
		);

		const packages = new Map<string, string>();
		for (const dir of yield* dependencyDirs(root, source)) {
			if (dir === source) {
				continue;
			}
			const name = path.basename(dir);
			const taken = packages.get(name);
			if (taken !== undefined) {
				return yield* new CopyError({
					message: `${app}: ${taken} and ${dir} would both be packages/${name}`,
				});
			}
			packages.set(name, dir);
			yield* copyTree(
				path.join(root, dir),
				path.join(target, "packages", name),
				(text) => text,
			);
		}

		const pkg = yield* readPackageJson(path.join(root, source));
		const port = devPort(pkg);
		if (port === undefined) {
			return yield* new CopyError({
				message: `${app}: the dev script has no --port`,
			});
		}
		yield* write("package.json", json(rootPackageJson(app, pkg, monorepo)));
		yield* write("pnpm-workspace.yaml", workspaceYaml);
		yield* write("README.md", standaloneReadme(app, pkg, port));
		yield* write(".gitignore", gitignore);
		yield* write("vercel.json", json(noDeployments));
		yield* write(".codesandbox/tasks.json", json(tasksJson(port)));
		yield* write(".codesandbox/template.json", json(templateJson(app, pkg)));
		yield* write(
			".devcontainer/devcontainer.json",
			json(devcontainerJson(app)),
		);
	}

	yield* fs.writeFileString(path.join(out, "README.md"), branchReadme);
	yield* fs.makeDirectory(path.join(out, "www"));
	yield* fs.writeFileString(
		path.join(out, "www", "vercel.json"),
		json(noDeployments),
	);
	return targets;
});
