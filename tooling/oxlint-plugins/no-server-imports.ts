import { defineRule } from "@oxlint/plugins";

/**
 * Ban runtime imports of server-only modules from code that ships to the
 * browser (see `.agent-docs/decisions/contract-split.md`).
 *
 * `sources` entries match the module and its subpaths (`@examples/db` also
 * matches `@examples/db/seed`); an entry ending in `*` matches by prefix
 * (`node:*`, `@effect/platform-node*`). Type-only imports and exports are
 * allowed: they are erased from the bundle.
 *
 * It is a separate rule from `no-restricted-imports` so overrides can set it
 * without replacing the root's `no-restricted-imports` options.
 */

function matches(source, entry) {
	return entry.endsWith("*")
		? source.startsWith(entry.slice(0, -1))
		: source === entry || source.startsWith(`${entry}/`);
}

function isTypeOnly(node) {
	if (node.importKind === "type" || node.exportKind === "type") {
		return true;
	}
	const specifiers = node.specifiers ?? [];
	return (
		specifiers.length > 0 &&
		specifiers.every(
			(specifier) =>
				specifier.importKind === "type" || specifier.exportKind === "type",
		)
	);
}

export const noServerImports = defineRule({
	meta: {
		type: "problem",
		docs: {
			description:
				"Disallow runtime imports of server-only modules in client code",
		},
		schema: [
			{
				type: "object",
				properties: {
					reason: { type: "string" },
					sources: { type: "array", items: { type: "string" } },
				},
				required: ["sources"],
				additionalProperties: false,
			},
		],
		messages: {
			serverOnly:
				"`{{source}}` is server-only: {{reason}} See .agent-docs/decisions/contract-split.md.",
		},
	},

	create(context) {
		const option = context.options[0];
		const isObject =
			typeof option === "object" && option !== null && !Array.isArray(option);
		const sources =
			isObject && Array.isArray(option.sources)
				? option.sources.filter((entry) => typeof entry === "string")
				: [];
		const reason =
			isObject && typeof option.reason === "string"
				? option.reason
				: "this file ships to the browser, so it may not import it.";

		function check(node, sourceNode) {
			if (
				sourceNode?.type !== "Literal" ||
				typeof sourceNode.value !== "string"
			) {
				return;
			}
			const source = sourceNode.value;
			if (sources.some((entry) => matches(source, entry))) {
				context.report({
					node: sourceNode,
					messageId: "serverOnly",
					data: { reason, source },
				});
			}
		}

		return {
			ExportAllDeclaration(node) {
				if (!isTypeOnly(node)) {
					check(node, node.source);
				}
			},
			ExportNamedDeclaration(node) {
				if (node.source && !isTypeOnly(node)) {
					check(node, node.source);
				}
			},
			ImportDeclaration(node) {
				if (!isTypeOnly(node)) {
					check(node, node.source);
				}
			},
			ImportExpression(node) {
				check(node, node.source);
			},
		};
	},
});
