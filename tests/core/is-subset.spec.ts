import { beforeAll, describe, expect, test } from "bun:test";
import type { JSONSchema7 } from "json-schema";
import { JsonSchemaCompatibilityChecker } from "../../src";

let checker: JsonSchemaCompatibilityChecker;

beforeAll(() => {
	checker = new JsonSchemaCompatibilityChecker();
});

describe("isSubset", () => {
	// ── Identity ─────────────────────────────────────────────────────────────

	test("A ⊆ A (identity) is always true", () => {
		const schema: JSONSchema7 = {
			type: "object",
			properties: { name: { type: "string" } },
			required: ["name"],
		};
		expect(checker.isSubset(schema, schema)).toBe(true);
	});

	test("empty schema ⊆ empty schema", () => {
		expect(checker.isSubset({}, {})).toBe(true);
	});

	test("boolean true ⊆ boolean true", () => {
		expect(checker.isSubset(true, true)).toBe(true);
	});

	test("boolean false ⊆ anything", () => {
		// false schema = no values allowed, so trivially subset of anything
		expect(checker.isSubset(false, true)).toBe(true);
		expect(checker.isSubset(false, { type: "string" })).toBe(true);
		expect(checker.isSubset(false, false)).toBe(true);
	});

	// ── Type compatibility ───────────────────────────────────────────────────

	test("integer ⊆ number", () => {
		expect(checker.isSubset({ type: "integer" }, { type: "number" })).toBe(
			true,
		);
	});

	test("number ⊄ integer", () => {
		expect(checker.isSubset({ type: "number" }, { type: "integer" })).toBe(
			false,
		);
	});

	test("string ⊄ number (incompatible types)", () => {
		expect(checker.isSubset({ type: "string" }, { type: "number" })).toBe(
			false,
		);
	});

	test("string ⊆ string", () => {
		expect(checker.isSubset({ type: "string" }, { type: "string" })).toBe(true);
	});

	// ── Object: required fields ──────────────────────────────────────────────

	test("more required ⊆ less required", () => {
		const strict: JSONSchema7 = {
			type: "object",
			properties: {
				name: { type: "string" },
				age: { type: "number" },
			},
			required: ["name", "age"],
		};
		const loose: JSONSchema7 = {
			type: "object",
			properties: { name: { type: "string" } },
			required: ["name"],
		};
		expect(checker.isSubset(strict, loose)).toBe(true);
	});

	test("less required ⊄ more required", () => {
		const strict: JSONSchema7 = {
			type: "object",
			properties: {
				name: { type: "string" },
				age: { type: "number" },
			},
			required: ["name", "age"],
		};
		const loose: JSONSchema7 = {
			type: "object",
			properties: { name: { type: "string" } },
			required: ["name"],
		};
		expect(checker.isSubset(loose, strict)).toBe(false);
	});

	// ── Object: additionalProperties ─────────────────────────────────────────

	test("closed object (additionalProperties: false) ⊆ open object", () => {
		const closed: JSONSchema7 = {
			type: "object",
			properties: { name: { type: "string" } },
			required: ["name"],
			additionalProperties: false,
		};
		const open: JSONSchema7 = {
			type: "object",
			properties: {
				name: { type: "string" },
				age: { type: "number" },
			},
			required: ["name"],
		};
		expect(checker.isSubset(closed, open)).toBe(true);
	});

	test("open object ⊄ closed object", () => {
		const closed: JSONSchema7 = {
			type: "object",
			properties: { name: { type: "string" } },
			required: ["name"],
			additionalProperties: false,
		};
		const open: JSONSchema7 = {
			type: "object",
			properties: {
				name: { type: "string" },
				age: { type: "number" },
			},
			required: ["name"],
		};
		expect(checker.isSubset(open, closed)).toBe(false);
	});

	// ── Numeric constraints ──────────────────────────────────────────────────

	test("strict numeric range ⊆ loose numeric range", () => {
		expect(
			checker.isSubset(
				{ type: "number", minimum: 5, maximum: 10 },
				{ type: "number", minimum: 0, maximum: 100 },
			),
		).toBe(true);
	});

	test("loose numeric range ⊄ strict numeric range", () => {
		expect(
			checker.isSubset(
				{ type: "number", minimum: 0, maximum: 100 },
				{ type: "number", minimum: 5, maximum: 10 },
			),
		).toBe(false);
	});

	test("exclusive minimum with same keyword family is handled", () => {
		// exclusiveMinimum: 5 means x > 5, exclusiveMinimum: 0 means x > 0
		// so [>5] ⊆ [>0] → true
		expect(
			checker.isSubset(
				{ type: "number", exclusiveMinimum: 5 },
				{ type: "number", exclusiveMinimum: 0 },
			),
		).toBe(true);
	});

	test("known limitation: cross-keyword constraints (exclusiveMinimum vs minimum) produce false negative", () => {
		// Semantically {exclusiveMinimum: 5} ⊆ {minimum: 0} is true (x>5 implies x≥0)
		// But the merge adds minimum:0 from sup, making merged ≠ sub structurally.
		// This is a known limitation of the structural intersection approach:
		// it cannot reason across different-but-related keywords.
		expect(
			checker.isSubset(
				{ type: "number", exclusiveMinimum: 5 },
				{ type: "number", minimum: 0 },
			),
		).toBe(false);
	});

	test("multipleOf: multiple of 6 ⊆ multiple of 3", () => {
		expect(
			checker.isSubset(
				{ type: "number", multipleOf: 6 },
				{ type: "number", multipleOf: 3 },
			),
		).toBe(true);
	});

	test("multipleOf: multiple of 3 ⊄ multiple of 6", () => {
		expect(
			checker.isSubset(
				{ type: "number", multipleOf: 3 },
				{ type: "number", multipleOf: 6 },
			),
		).toBe(false);
	});

	// ── String constraints ───────────────────────────────────────────────────

	test("strict string ⊆ loose string", () => {
		const strict: JSONSchema7 = {
			type: "string",
			minLength: 3,
			maxLength: 10,
			pattern: "^[a-z]+$",
		};
		const loose: JSONSchema7 = {
			type: "string",
			minLength: 1,
			maxLength: 100,
		};
		expect(checker.isSubset(strict, loose)).toBe(true);
	});

	test("loose string ⊄ strict string", () => {
		const strict: JSONSchema7 = {
			type: "string",
			minLength: 3,
			maxLength: 10,
		};
		const loose: JSONSchema7 = {
			type: "string",
			minLength: 1,
			maxLength: 100,
		};
		expect(checker.isSubset(loose, strict)).toBe(false);
	});

	// ── Enum ─────────────────────────────────────────────────────────────────

	test("small enum ⊆ large enum", () => {
		expect(
			checker.isSubset(
				{ type: "string", enum: ["a", "b"] },
				{ type: "string", enum: ["a", "b", "c", "d"] },
			),
		).toBe(true);
	});

	test("large enum ⊄ small enum", () => {
		expect(
			checker.isSubset(
				{ type: "string", enum: ["a", "b", "c", "d"] },
				{ type: "string", enum: ["a", "b"] },
			),
		).toBe(false);
	});

	test("single value enum ⊆ type", () => {
		expect(
			checker.isSubset({ type: "string", enum: ["hello"] }, { type: "string" }),
		).toBe(true);
	});

	// ── Array constraints ────────────────────────────────────────────────────

	test("strict array ⊆ loose array", () => {
		const strict: JSONSchema7 = {
			type: "array",
			items: { type: "string", minLength: 1 },
			minItems: 1,
			maxItems: 5,
		};
		const loose: JSONSchema7 = {
			type: "array",
			items: { type: "string" },
		};
		expect(checker.isSubset(strict, loose)).toBe(true);
	});

	test("loose array ⊄ strict array", () => {
		const strict: JSONSchema7 = {
			type: "array",
			items: { type: "string", minLength: 1 },
			minItems: 1,
			maxItems: 5,
		};
		const loose: JSONSchema7 = {
			type: "array",
			items: { type: "string" },
		};
		expect(checker.isSubset(loose, strict)).toBe(false);
	});

	test("array with uniqueItems: true ⊆ array without uniqueItems", () => {
		expect(
			checker.isSubset(
				{ type: "array", items: { type: "number" }, uniqueItems: true },
				{ type: "array", items: { type: "number" } },
			),
		).toBe(true);
	});

	// ── Deep nested objects ──────────────────────────────────────────────────

	test("deeply nested strict ⊆ deeply nested loose", () => {
		const deep: JSONSchema7 = {
			type: "object",
			properties: {
				user: {
					type: "object",
					properties: {
						profile: {
							type: "object",
							properties: {
								name: { type: "string" },
								bio: { type: "string" },
							},
							required: ["name", "bio"],
						},
					},
					required: ["profile"],
				},
			},
			required: ["user"],
		};
		const shallow: JSONSchema7 = {
			type: "object",
			properties: {
				user: {
					type: "object",
					properties: {
						profile: {
							type: "object",
							properties: { name: { type: "string" } },
							required: ["name"],
						},
					},
					required: ["profile"],
				},
			},
			required: ["user"],
		};
		expect(checker.isSubset(deep, shallow)).toBe(true);
		expect(checker.isSubset(shallow, deep)).toBe(false);
	});

	// ── anyOf / oneOf ────────────────────────────────────────────────────────

	test("anyOf subset ⊆ anyOf superset", () => {
		const sub: JSONSchema7 = {
			anyOf: [{ type: "string" }, { type: "number" }],
		};
		const sup: JSONSchema7 = {
			anyOf: [{ type: "string" }, { type: "number" }, { type: "boolean" }],
		};
		expect(checker.isSubset(sub, sup)).toBe(true);
	});

	test("anyOf superset ⊄ anyOf subset", () => {
		const sub: JSONSchema7 = {
			anyOf: [{ type: "string" }, { type: "number" }],
		};
		const sup: JSONSchema7 = {
			anyOf: [{ type: "string" }, { type: "number" }, { type: "boolean" }],
		};
		expect(checker.isSubset(sup, sub)).toBe(false);
	});

	test("atomic ⊆ anyOf containing matching branch", () => {
		expect(
			checker.isSubset(
				{ type: "string", minLength: 1 },
				{ anyOf: [{ type: "string" }, { type: "number" }] },
			),
		).toBe(true);
	});

	test("atomic ⊄ anyOf with no matching branch", () => {
		expect(
			checker.isSubset(
				{ type: "boolean" },
				{ anyOf: [{ type: "string" }, { type: "number" }] },
			),
		).toBe(false);
	});

	test("oneOf with const values ⊆ oneOf with matching types", () => {
		const sub: JSONSchema7 = {
			oneOf: [
				{
					type: "object",
					properties: {
						kind: { const: "a" },
						value: { type: "string" },
					},
					required: ["kind", "value"],
				},
				{
					type: "object",
					properties: {
						kind: { const: "b" },
						value: { type: "number" },
					},
					required: ["kind", "value"],
				},
			],
		};
		const sup: JSONSchema7 = {
			oneOf: [
				{
					type: "object",
					properties: {
						kind: { type: "string" },
						value: { type: "string" },
					},
					required: ["kind", "value"],
				},
				{
					type: "object",
					properties: {
						kind: { type: "string" },
						value: { type: "number" },
					},
					required: ["kind", "value"],
				},
			],
		};
		expect(checker.isSubset(sub, sup)).toBe(true);
	});

	// ── const ────────────────────────────────────────────────────────────────

	test("const string ⊆ type string", () => {
		expect(checker.isSubset({ const: "hello" }, { type: "string" })).toBe(true);
	});

	test("const number ⊆ type number", () => {
		expect(checker.isSubset({ const: 42 }, { type: "number" })).toBe(true);
	});

	test("const string ⊄ type number", () => {
		expect(checker.isSubset({ const: "hello" }, { type: "number" })).toBe(
			false,
		);
	});

	// ── Boolean schemas ──────────────────────────────────────────────────────

	test("any schema ⊆ true (allows everything)", () => {
		expect(checker.isSubset({ type: "string" }, true)).toBe(true);
		expect(
			checker.isSubset(
				{ type: "object", properties: { x: { type: "number" } } },
				true,
			),
		).toBe(true);
	});

	test("true ⊄ concrete schema (true allows more)", () => {
		expect(checker.isSubset(true, { type: "string" })).toBe(false);
	});
});
