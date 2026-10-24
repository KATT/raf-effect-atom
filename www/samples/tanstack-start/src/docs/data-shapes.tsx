import {
	createRootRouteWithContext,
	createRoute,
} from "@tanstack/react-router";
import { Effect, Schedule, Schema } from "effect";
import { AsyncResult, type Atom } from "effect/reactivity";
import { type LoadedHandle, Loader } from "raf-effect-atom";

// The endpoints below are hypothetical: each region shows a shape and what
// it costs a loader.
interface Project {
	readonly currentRelease: string;
	readonly id: string;
}
interface File {
	readonly path: string;
}
interface Account {
	readonly id: string;
}
interface Tool {
	readonly name: string;
}
interface Apps {
	readonly names: ReadonlyArray<string>;
	/** True while a background job is still installing the default apps. */
	readonly pending: boolean;
}
type Query<A> = Atom.Atom<AsyncResult.AsyncResult<A, Unauthorized>>;
interface Unauthorized {
	readonly _tag: "Unauthorized";
}

declare const project: (id: string) => Query<Project>;
declare const releaseFiles: (
	projectId: string,
	release: string,
) => Query<ReadonlyArray<File>>;
declare const publishedPackage: (name: string) => Query<{ commit: string }>;
declare const filesAtCommit: (
	name: string,
	commit: string,
) => Query<ReadonlyArray<File>>;
declare const publishedFiles: (name: string) => Query<ReadonlyArray<File>>;
declare const workspaceAccess: (workspaceId: string) => Query<true>;
declare const workspaceMembers: (
	workspaceId: string,
) => Query<ReadonlyArray<string>>;
declare const workspaceActivity: (
	workspaceId: string,
) => Query<ReadonlyArray<string>>;
declare const linkedAccounts: (
	workspaceId: string,
) => Query<ReadonlyArray<Account>>;
declare const accountTools: (accountId: string) => Query<ReadonlyArray<Tool>>;
declare const workspaceApps: (workspaceId: string) => Query<Apps>;

const appRoot = createRootRouteWithContext<{
	readonly atoms: Loader.Loader;
}>()();

// #region id-from-response
const projectRoute = createRoute({
	getParentRoute: () => appRoot,
	path: "/projects/$projectId",
	validateSearch: Schema.toStandardSchemaV1(
		Schema.Struct({ release: Schema.optional(Schema.String) }),
	),
	loaderDeps: ({ search }) => ({ release: search.release }),
	loader: async ({ context, deps, params }) => {
		if (deps.release !== undefined) {
			// A link that knew the release named it: both start now.
			return {
				files: context.atoms.prefetch(
					releaseFiles,
					params.projectId,
					deps.release,
				),
				project: context.atoms.prefetch(project, params.projectId),
			};
		}
		// Only the project knows its release: the files start a round trip
		// later.
		const parent = await context.atoms.ensure(project, params.projectId);
		const found = Loader.result(parent);
		return {
			files: AsyncResult.isSuccess(found)
				? context.atoms.prefetch(
						releaseFiles,
						params.projectId,
						found.value.currentRelease,
					)
				: undefined,
			project: parent,
		};
	},
});
// #endregion id-from-response

// #region child-with-parent
const packageRoute = createRoute({
	getParentRoute: () => appRoot,
	path: "/packages/$name",
	loader: async ({ context, params }) => {
		// The files take the commit the package's read returns.
		const pkg = await context.atoms.ensure(publishedPackage, params.name);
		const found = Loader.result(pkg);
		return {
			files: AsyncResult.isSuccess(found)
				? context.atoms.prefetch(filesAtCommit, params.name, found.value.commit)
				: undefined,
			pkg,
		};
	},
});

const resolvedPackageRoute = createRoute({
	getParentRoute: () => appRoot,
	path: "/packages/$name/files",
	// The backend resolves the commit from the name: both start now.
	loader: ({ context, params }) => ({
		files: context.atoms.prefetch(publishedFiles, params.name),
		pkg: context.atoms.prefetch(publishedPackage, params.name),
	}),
});
// #endregion child-with-parent

// #region gate
const workspaceRoute = createRoute({
	getParentRoute: () => appRoot,
	path: "/workspaces/$workspaceId",
	loader: async ({ context, params }) => {
		// Each endpoint checks access itself, so the reads start with the
		// check: a failed check's reads fail with Unauthorized too.
		const members = context.atoms.prefetch(
			workspaceMembers,
			params.workspaceId,
		);
		const activity = context.atoms.prefetch(
			workspaceActivity,
			params.workspaceId,
		);
		// The page waits for the check alone, and its boundary handles
		// Unauthorized.
		const access = await context.atoms.ensure(
			workspaceAccess,
			params.workspaceId,
		);
		return { access, activity, members };
	},
});
// #endregion gate

// #region per-item
const toolsRoute = createRoute({
	getParentRoute: () => appRoot,
	path: "/workspaces/$workspaceId/tools",
	loader: async ({ context, params }) => {
		// One read per account, each a round trip after the list.
		const accounts = await context.atoms.ensure(
			linkedAccounts,
			params.workspaceId,
		);
		const found = Loader.result(accounts);
		const ids = AsyncResult.isSuccess(found)
			? found.value.map((account) => account.id)
			: [];
		const tools = ids.map((id) => context.atoms.prefetch(accountTools, id));
		//    ^?
		return { accounts, tools };
	},
});
// #endregion per-item

// #region provisioning
const isSettledList = (handle: LoadedHandle<typeof workspaceApps>) => {
	const result = Loader.result(handle);
	return !AsyncResult.isSuccess(result) || !result.value.pending;
};

const appsRoute = createRoute({
	getParentRoute: () => appRoot,
	path: "/workspaces/$workspaceId/apps",
	// Reads the list again every 250 milliseconds while the job runs, for at
	// most 40 more reads, then sends the list it has.
	loader: ({ context, params }) =>
		context.atoms.run(
			Loader.fetch(workspaceApps, params.workspaceId).pipe(
				Effect.repeat({
					schedule: Schedule.spaced("250 millis"),
					times: 40,
					until: isSettledList,
				}),
				Effect.map((apps) => ({ apps })),
			),
		),
});
// #endregion provisioning
