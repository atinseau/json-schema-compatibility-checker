import { beforeAll, describe, expect, test } from "bun:test";
import type { JSONSchema7 } from "json-schema";
import { JsonSchemaCompatibilityChecker } from "../../src";

let checker: JsonSchemaCompatibilityChecker;

beforeAll(() => {
	checker = new JsonSchemaCompatibilityChecker();
});

// ─────────────────────────────────────────────────────────────────────────────
//  canConnect
// ─────────────────────────────────────────────────────────────────────────────

describe("canConnect", () => {
	const nodeAOutput: JSONSchema7 = {
		type: "object",
		properties: {
			order: {
				type: "object",
				properties: {
					id: { type: "string" },
					total: { type: "number", minimum: 0 },
					items: {
						type: "array",
						items: {
							type: "object",
							properties: {
								sku: { type: "string" },
								qty: { type: "integer", minimum: 1 },
								price: { type: "number", minimum: 0 },
							},
							required: ["sku", "qty", "price"],
						},
						minItems: 1,
					},
					customer: {
						type: "object",
						properties: {
							email: { type: "string", format: "email" },
							name: { type: "string" },
						},
						required: ["email", "name"],
					},
				},
				required: ["id", "total", "items", "customer"],
			},
		},
		required: ["order"],
	};

	const nodeBInput: JSONSchema7 = {
		type: "object",
		properties: {
			order: {
				type: "object",
				properties: {
					id: { type: "string" },
					total: { type: "number" },
					customer: {
						type: "object",
						properties: { email: { type: "string" } },
						required: ["email"],
					},
				},
				required: ["id", "total", "customer"],
			},
		},
		required: ["order"],
	};

	test("compatible output → input returns isSubset true", () => {
		const result = checker.canConnect(nodeAOutput, nodeBInput);

		expect(result.isSubset).toBe(true);
		expect(result.direction).toBe("sourceOutput ⊆ targetInput");
		expect(result.diffs).toEqual([]);
	});

	test("incompatible input → output returns isSubset false with diffs", () => {
		const result = checker.canConnect(nodeBInput, nodeAOutput);

		expect(result.isSubset).toBe(false);
		expect(result.direction).toBe("sourceOutput ⊆ targetInput");
		expect(result.diffs.length).toBeGreaterThan(0);
	});

	test("identical schemas are always connectable", () => {
		const schema: JSONSchema7 = {
			type: "object",
			properties: { id: { type: "string" } },
			required: ["id"],
		};
		const result = checker.canConnect(schema, schema);

		expect(result.isSubset).toBe(true);
	});

	test("empty output can connect to empty input", () => {
		const result = checker.canConnect({}, {});

		expect(result.isSubset).toBe(true);
	});

	test("typed output cannot connect to incompatible input", () => {
		const result = checker.canConnect(
			{
				type: "object",
				properties: { val: { type: "string" } },
				required: ["val"],
			},
			{
				type: "object",
				properties: { val: { type: "number" } },
				required: ["val"],
			},
		);

		expect(result.isSubset).toBe(false);
	});
});
