import { NodeServices } from "@effect/platform-node";
import { assert, describe, it } from "@effect/vitest";
import { Effect, FileSystem } from "effect";

import { logoSvg, logoUrl } from "./logo.ts";

const favicon = new URL(
	"../../../../../www/public/favicon.svg",
	import.meta.url,
);

describe("logo", () => {
	it.effect("is www/public/favicon.svg", () =>
		Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			assert.strictEqual(logoSvg, yield* fs.readFileString(favicon.pathname));
		}).pipe(Effect.provide(NodeServices.layer)),
	);

	it("is a data URL of the SVG", () => {
		assert.strictEqual(
			decodeURIComponent(logoUrl.slice("data:image/svg+xml,".length)),
			logoSvg,
		);
	});
});
