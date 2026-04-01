import { beforeAll, describe, expect, test } from "bun:test";
import { JsonSchemaCompatibilityChecker } from "../../src";

let checker: JsonSchemaCompatibilityChecker;

beforeAll(() => {
	checker = new JsonSchemaCompatibilityChecker();
});

// ═══════════════════════════════════════════════════════════════════════════════
//  Bug — False positive `type_mismatch` when sub has `const` and sup has `type`
//
//  `formatSchemaType` prioritizes `const` over `type`, so a schema like
//  { type: "string", const: "hello" } formats as "hello" instead of "string".
//  The fallback comparison in computeSemanticErrors compares these strings,
//  producing a phantom type_mismatch on type-compatible schemas.
//
//  The bug only surfaces when there is at least one *other* real error
//  (otherwise computeSemanticErrors is never called).
// ═══════════════════════════════════════════════════════════════════════════════

describe("Bug — false positive type_mismatch with const", () => {
	// ── Scenario 1: const string vs type: "string" ──
	test("no type_mismatch for const string property when missing sibling causes real error", () => {
		const result = checker.check(
			{
				type: "object",
				properties: {
					name: { type: "string", const: "Alice" },
				},
				required: ["name"],
			},
			{
				type: "object",
				properties: {
					name: { type: "string" },
					age: { type: "number" },
				},
				required: ["name", "age"],
			},
		);

		expect(result.isSubset).toBe(false);
		// Should have ONLY the missing_property error for "age"
		expect(result.errors).toContainEqual(
			expect.objectContaining({ type: "missing_property", key: "age" }),
		);
		// Must NOT have a type_mismatch for "name"
		expect(result.errors).not.toContainEqual(
			expect.objectContaining({ type: "type_mismatch", key: "name" }),
		);
	});

	// ── Scenario 2: const number vs type: "number" ──
	test("no type_mismatch for const number property", () => {
		const result = checker.check(
			{
				type: "object",
				properties: {
					count: { type: "number", const: 42 },
				},
				required: ["count"],
			},
			{
				type: "object",
				properties: {
					count: { type: "number" },
					label: { type: "string" },
				},
				required: ["count", "label"],
			},
		);

		expect(result.isSubset).toBe(false);
		expect(result.errors).toContainEqual(
			expect.objectContaining({ type: "missing_property", key: "label" }),
		);
		expect(result.errors).not.toContainEqual(
			expect.objectContaining({ type: "type_mismatch", key: "count" }),
		);
	});

	// ── Scenario 3: const boolean vs type: "boolean" ──
	test("no type_mismatch for const boolean property", () => {
		const result = checker.check(
			{
				type: "object",
				properties: {
					active: { type: "boolean", const: true },
				},
				required: ["active"],
			},
			{
				type: "object",
				properties: {
					active: { type: "boolean" },
					name: { type: "string" },
				},
				required: ["active", "name"],
			},
		);

		expect(result.isSubset).toBe(false);
		expect(result.errors).toContainEqual(
			expect.objectContaining({ type: "missing_property", key: "name" }),
		);
		expect(result.errors).not.toContainEqual(
			expect.objectContaining({ type: "type_mismatch", key: "active" }),
		);
	});

	// ── Scenario 4: array items with const ──
	test("no type_mismatch for array items with const", () => {
		const result = checker.check(
			{
				type: "object",
				properties: {
					tags: {
						type: "array",
						items: { type: "string", const: "urgent" },
						minItems: 1,
						maxItems: 1,
					},
				},
				required: ["tags"],
			},
			{
				type: "object",
				properties: {
					tags: { type: "array", items: { type: "string" } },
					priority: { type: "number" },
				},
				required: ["tags", "priority"],
			},
		);

		expect(result.isSubset).toBe(false);
		expect(result.errors).toContainEqual(
			expect.objectContaining({ type: "missing_property", key: "priority" }),
		);
		expect(result.errors).not.toContainEqual(
			expect.objectContaining({ type: "type_mismatch", key: "tags[]" }),
		);
	});

	// ── Scenario 5: nested object with const ──
	test("no type_mismatch for nested property with const", () => {
		const result = checker.check(
			{
				type: "object",
				properties: {
					config: {
						type: "object",
						properties: {
							mode: { type: "string", const: "strict" },
						},
						required: ["mode"],
					},
				},
				required: ["config"],
			},
			{
				type: "object",
				properties: {
					config: {
						type: "object",
						properties: {
							mode: { type: "string" },
							timeout: { type: "number" },
						},
						required: ["mode", "timeout"],
					},
				},
				required: ["config"],
			},
		);

		expect(result.isSubset).toBe(false);
		expect(result.errors).toContainEqual(
			expect.objectContaining({
				type: "missing_property",
				key: "config.timeout",
			}),
		);
		expect(result.errors).not.toContainEqual(
			expect.objectContaining({ type: "type_mismatch", key: "config.mode" }),
		);
	});

	// ── Scenario 6: data narrowing injects const ──
	test("no type_mismatch when data narrowing adds const to array items", async () => {
		const result = await checker.check(
			{
				type: "object",
				properties: {
					target: {
						type: "array",
						items: { type: "string" },
					},
				},
				required: ["target"],
				additionalProperties: false,
			},
			{
				type: "object",
				properties: {
					target: {
						type: "array",
						items: { type: "string" },
					},
					templateId: {
						type: "number",
					},
				},
				required: ["target", "templateId"],
			},
			{
				data: {
					target: ["200c60d3-13bc-4793-9e19-0fca640bab9d"],
				},
				validate: { sup: { partial: true } },
			},
		);

		expect(result.isSubset).toBe(false);
		expect(result.errors).toContainEqual(
			expect.objectContaining({
				type: "missing_property",
				key: "templateId",
			}),
		);
		expect(result.errors).not.toContainEqual(
			expect.objectContaining({ type: "type_mismatch" }),
		);
	});

	// ── Scenario 7: enum without not — sub has enum, sup has only type ──
	test("no type_mismatch for enum property when sup has only type", () => {
		const result = checker.check(
			{
				type: "object",
				properties: {
					status: { type: "string", enum: ["a", "b"] },
				},
				required: ["status"],
			},
			{
				type: "object",
				properties: {
					status: { type: "string" },
					extra: { type: "number" },
				},
				required: ["status", "extra"],
			},
		);

		expect(result.isSubset).toBe(false);
		expect(result.errors).toContainEqual(
			expect.objectContaining({ type: "missing_property", key: "extra" }),
		);
		expect(result.errors).not.toContainEqual(
			expect.objectContaining({ type: "type_mismatch", key: "status" }),
		);
	});

	// ── Scenario 8: integer vs number ──
	test("no type_mismatch for integer vs number", () => {
		const result = checker.check(
			{
				type: "object",
				properties: {
					count: { type: "integer" },
				},
				required: ["count"],
			},
			{
				type: "object",
				properties: {
					count: { type: "number" },
					name: { type: "string" },
				},
				required: ["count", "name"],
			},
		);

		expect(result.isSubset).toBe(false);
		expect(result.errors).toContainEqual(
			expect.objectContaining({ type: "missing_property", key: "name" }),
		);
		expect(result.errors).not.toContainEqual(
			expect.objectContaining({ type: "type_mismatch", key: "count" }),
		);
	});

	// ── Sanity: real type mismatches must still be reported ──
	test("real type_mismatch is still reported when types differ", () => {
		const result = checker.check(
			{
				type: "object",
				properties: {
					value: { type: "string" },
				},
				required: ["value"],
			},
			{
				type: "object",
				properties: {
					value: { type: "number" },
				},
				required: ["value"],
			},
		);

		expect(result.isSubset).toBe(false);
		expect(result.errors).toContainEqual(
			expect.objectContaining({ type: "type_mismatch", key: "value" }),
		);
	});
});
