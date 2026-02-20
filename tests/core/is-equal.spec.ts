import { beforeAll, describe, expect, test } from "bun:test";
import type { JSONSchema7 } from "json-schema";
import { JsonSchemaCompatibilityChecker } from "../../src";

let checker: JsonSchemaCompatibilityChecker;

beforeAll(() => {
	checker = new JsonSchemaCompatibilityChecker();
});

// ─────────────────────────────────────────────────────────────────────────────
//  isEqual
// ─────────────────────────────────────────────────────────────────────────────

describe("isEqual", () => {
	test("identical schemas are equal", () => {
		const schema: JSONSchema7 = {
			type: "object",
			properties: {
				name: { type: "string" },
				age: { type: "number" },
			},
			required: ["name", "age"],
		};
		expect(checker.isEqual(schema, schema)).toBe(true);
	});

	test("structurally identical but different references are equal", () => {
		const a: JSONSchema7 = {
			type: "object",
			properties: { x: { type: "number" } },
			required: ["x"],
		};
		const b: JSONSchema7 = {
			type: "object",
			properties: { x: { type: "number" } },
			required: ["x"],
		};
		expect(checker.isEqual(a, b)).toBe(true);
	});

	test("different schemas are not equal", () => {
		expect(checker.isEqual({ type: "string" }, { type: "number" })).toBe(false);
	});

	test("schema with extra property is not equal", () => {
		expect(
			checker.isEqual(
				{ type: "object", properties: { a: { type: "string" } } },
				{
					type: "object",
					properties: {
						a: { type: "string" },
						b: { type: "number" },
					},
				},
			),
		).toBe(false);
	});

	test("different required makes schemas not equal", () => {
		expect(
			checker.isEqual(
				{
					type: "object",
					properties: { a: { type: "string" } },
					required: ["a"],
				},
				{
					type: "object",
					properties: { a: { type: "string" } },
				},
			),
		).toBe(false);
	});

	test("const schemas with same value are equal after normalization", () => {
		expect(
			checker.isEqual({ const: "test" }, { const: "test", type: "string" }),
		).toBe(true);
	});

	test("boolean schemas: true ≠ false", () => {
		expect(checker.isEqual(true, false)).toBe(false);
	});

	test("boolean schemas: true === true", () => {
		expect(checker.isEqual(true, true)).toBe(true);
	});

	test("empty schema equals empty schema", () => {
		expect(checker.isEqual({}, {})).toBe(true);
	});
});
