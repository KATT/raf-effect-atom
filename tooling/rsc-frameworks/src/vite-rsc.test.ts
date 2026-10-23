import { NodeServices } from "@effect/platform-node";
import { describe, expect, it, vi } from "@effect/vitest";
import { Effect, Path } from "effect";
import { createBuilder } from "vite";

type Handler = (request: Request) => Promise<Response>;

/** Builds `vite-rsc/` into its `dist/` and imports the RSC entry. */
const buildApp = Effect.fn("buildApp")(function* () {
	const path = yield* Path.Path;
	const root = path.join(import.meta.dirname, "../vite-rsc");
	yield* Effect.tryPromise(async () => {
		const builder = await createBuilder({
			configFile: path.join(root, "vite.config.ts"),
			logLevel: "warn",
			root,
		});
		await builder.buildApp();
	});
	const entry = path.join(root, "dist/rsc/index.js");
	const module = yield* Effect.tryPromise(
		(): Promise<{ default: Handler }> => import(entry),
	);
	return module.default;
});

const request = Effect.fn("request")(function* (handler: Handler, url: string) {
	globalThis.atomRuns = [];
	const response = yield* Effect.tryPromise(() => handler(new Request(url)));
	return yield* Effect.tryPromise(() => response.text());
});

describe("@vitejs/plugin-rsc", () => {
	it.effect(
		"renders what the server component's HydrationBoundary sent, and runs each atom once",
		() =>
			Effect.gen(function* () {
				// A production build, as deployed. Vitest sets `test`, which
				// builds development JSX.
				vi.stubEnv("NODE_ENV", "production");
				const handler = yield* buildApp();

				const html = yield* request(handler, "http://localhost/");
				expect(html).toContain("<h1>Post hello</h1>");
				expect(html).toContain("<p>First comment on hello</p>");
				// The server component started both. The client components'
				// server render started neither.
				expect(globalThis.atomRuns?.toSorted()).toEqual([
					"comments hello",
					"post hello",
				]);

				const payload = yield* request(handler, "http://localhost/?rsc");
				// The server build of HydrationBoundary rendered: it sent the
				// registry's state to the client one. The client build would
				// have been a reference given the registry, which React refuses
				// to serialize.
				// A reference names its export inline, or as `"$<row>"`, a row
				// that holds the name.
				const rows = new Map(
					[...payload.matchAll(/^(\w+):"(\w+)"$/gm)].map((match) => [
						match[1],
						match[2],
					]),
				);
				const clientReferences = [
					...payload.matchAll(/I\["[^"]+",\[[^\]]*\],"(\$?\w+)"/g),
				].map((match) =>
					match[1].startsWith("$") ? rows.get(match[1].slice(1)) : match[1],
				);
				expect(clientReferences.toSorted()).toEqual([
					"Comments",
					"HydrationBoundary",
					"Post",
					"RegistryProvider",
				]);
				// The comments were still loading, so they crossed as a promise
				// resolved later in the stream.
				expect(payload).toMatch(/"resultPromise":"\$@\w+"/);
				expect(payload).toContain("First comment on hello");
				expect(globalThis.atomRuns?.toSorted()).toEqual([
					"comments hello",
					"post hello",
				]);
			}).pipe(Effect.provide(NodeServices.layer)),
	);
});
