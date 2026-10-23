import { RuleTester } from "oxlint/plugins-dev";
import { describe, it } from "vitest";
import plugin from "./workspace.ts";

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({
	languageOptions: { parserOptions: { lang: "tsx" } },
});

const frontend = [{ sources: ["@examples/backend", "@examples/db"] }];

const contract = [
	{
		reason: "the contract ships to the browser.",
		sources: ["node:*", "@effect/platform-node*", "@examples/*"],
	},
];

tester.run("no-server-imports", plugin.rules["no-server-imports"], {
	valid: [
		{
			code: `import { IssueRpcs } from "@examples/contract";`,
			options: frontend,
		},
		{ code: `import type { Store } from "@examples/db";`, options: frontend },
		{ code: `import { type Store } from "@examples/db";`, options: frontend },
		{ code: `export type { Store } from "@examples/db";`, options: frontend },
		{ code: `import { Button } from "@examples/ui";`, options: frontend },
		{ code: `import { Effect } from "effect";`, options: contract },
		{ code: `import { RpcMiddleware } from "effect/rpc";`, options: contract },
		{ code: `import { readFile } from "node:fs";` },
	],
	invalid: [
		{
			code: `import { handler } from "@examples/backend";`,
			errors: [{ messageId: "serverOnly" }],
			options: frontend,
		},
		{
			code: `import { Issues } from "@examples/db";`,
			errors: [{ messageId: "serverOnly" }],
			options: frontend,
		},
		{
			code: `import { seed } from "@examples/db/seed";`,
			errors: [{ messageId: "serverOnly" }],
			options: frontend,
		},
		{
			code: `import { type Store, Issues } from "@examples/db";`,
			errors: [{ messageId: "serverOnly" }],
			options: frontend,
		},
		{
			code: `export { handler } from "@examples/backend";`,
			errors: [{ messageId: "serverOnly" }],
			options: frontend,
		},
		{
			code: `export * from "@examples/db";`,
			errors: [{ messageId: "serverOnly" }],
			options: frontend,
		},
		{
			code: `const backend = await import("@examples/backend");`,
			errors: [{ messageId: "serverOnly" }],
			options: frontend,
		},
		{
			code: `import "@examples/db";`,
			errors: [{ messageId: "serverOnly" }],
			options: frontend,
		},
		{
			code: `import { readFile } from "node:fs/promises";`,
			errors: [{ messageId: "serverOnly" }],
			options: contract,
		},
		{
			code: `import { NodeHttpServer } from "@effect/platform-node";`,
			errors: [{ messageId: "serverOnly" }],
			options: contract,
		},
		{
			code: `import { Button } from "@examples/ui";`,
			errors: [{ messageId: "serverOnly" }],
			options: contract,
		},
	],
});
