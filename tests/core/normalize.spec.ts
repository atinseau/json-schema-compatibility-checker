import { beforeAll, describe, expect, test } from "bun:test";
import type { JSONSchema7 } from "json-schema";
import { JsonSchemaCompatibilityChecker } from "../../src";

let checker: JsonSchemaCompatibilityChecker;

beforeAll(() => {
	checker = new JsonSchemaCompatibilityChecker();
});

// ═══════════════════════════════════════════════════════════════════════════════
//  Normalize — type inference, recursive normalization, and edge cases
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
//  normalize
// ─────────────────────────────────────────────────────────────────────────────

describe("normalize", () => {
	test("infers type: string from const string", () => {
		const result = checker.normalize({ const: "hello" }) as JSONSchema7;
		expect(result.type).toBe("string");
		expect(result.const).toBe("hello");
	});

	test("infers type: number from const number", () => {
		const result = checker.normalize({ const: 3.14 }) as JSONSchema7;
		expect(result.type).toBe("number");
	});

	test("infers type: integer from const integer", () => {
		const result = checker.normalize({ const: 42 }) as JSONSchema7;
		expect(result.type).toBe("integer");
	});

	test("infers type: boolean from const boolean", () => {
		const result = checker.normalize({ const: true }) as JSONSchema7;
		expect(result.type).toBe("boolean");
	});

	test("infers type: object from const object", () => {
		const result = checker.normalize({ const: { a: 1 } }) as JSONSchema7;
		expect(result.type).toBe("object");
	});

	test("infers type: array from const array", () => {
		const result = checker.normalize({ const: [1, 2, 3] }) as JSONSchema7;
		expect(result.type).toBe("array");
	});

	test("infers type from enum with homogeneous types", () => {
		const result = checker.normalize({
			enum: [1, 2, 3],
		}) as JSONSchema7;
		expect(result.type).toBe("integer");
	});

	test("infers multi-type from enum with heterogeneous types", () => {
		const result = checker.normalize({
			enum: ["a", 1],
		}) as JSONSchema7;
		expect(result.type).toEqual(expect.arrayContaining(["string", "integer"]));
	});

	test("does not overwrite existing type", () => {
		const result = checker.normalize({
			const: 42,
			type: "number",
		}) as JSONSchema7;
		expect(result.type).toBe("number");
	});

	test("normalizes nested properties recursively", () => {
		const result = checker.normalize({
			type: "object",
			properties: {
				status: { const: "active" },
			},
		}) as JSONSchema7;

		const statusSchema = result.properties?.status as JSONSchema7;
		expect(statusSchema.type).toBe("string");
		expect(statusSchema.const).toBe("active");
	});

	test("normalizes items schema", () => {
		const result = checker.normalize({
			type: "array",
			items: { const: "item" },
		}) as JSONSchema7;

		const itemsSchema = result.items as JSONSchema7;
		expect(itemsSchema.type).toBe("string");
	});

	test("normalizes tuple items", () => {
		const result = checker.normalize({
			type: "array",
			items: [{ const: "a" }, { const: 1 }],
		}) as JSONSchema7;

		const items = result.items as JSONSchema7[];
		expect((items[0] as JSONSchema7).type).toBe("string");
		expect((items[1] as JSONSchema7).type).toBe("integer");
	});

	test("normalizes anyOf branches", () => {
		const result = checker.normalize({
			anyOf: [{ const: "a" }, { const: 1 }],
		}) as JSONSchema7;

		const branches = result.anyOf as JSONSchema7[];
		expect((branches[0] as JSONSchema7).type).toBe("string");
		expect((branches[1] as JSONSchema7).type).toBe("integer");
	});

	test("normalizes oneOf branches", () => {
		const result = checker.normalize({
			oneOf: [{ const: true }, { const: "yes" }],
		}) as JSONSchema7;

		const branches = result.oneOf as JSONSchema7[];
		expect((branches[0] as JSONSchema7).type).toBe("boolean");
		expect((branches[1] as JSONSchema7).type).toBe("string");
	});

	test("normalizes additionalProperties sub-schema", () => {
		const result = checker.normalize({
			type: "object",
			additionalProperties: { const: 0 },
		}) as JSONSchema7;

		const addProps = result.additionalProperties as JSONSchema7;
		expect(addProps.type).toBe("integer");
	});

	test("boolean schema passes through unchanged", () => {
		expect(checker.normalize(true)).toBe(true);
		expect(checker.normalize(false)).toBe(false);
	});

	test("schema without const or enum is unchanged structurally", () => {
		const original: JSONSchema7 = {
			type: "string",
			minLength: 1,
			maxLength: 100,
		};
		const result = checker.normalize(original) as JSONSchema7;
		expect(result.type).toBe("string");
		expect(result.minLength).toBe(1);
		expect(result.maxLength).toBe(100);
	});
});

describe("normalizer — edge cases", () => {
	test("const: null → infers type: null", () => {
		const result = checker.normalize({ const: null }) as JSONSchema7;
		expect(result.type).toBe("null");
	});

	test("enum with all same types → infers single type", () => {
		const result = checker.normalize({ enum: [1, 2, 3] }) as JSONSchema7;
		expect(result.type).toBe("integer");
	});

	test("enum with mixed types → infers array of types", () => {
		const result = checker.normalize({ enum: ["hello", 42] }) as JSONSchema7;
		expect(Array.isArray(result.type)).toBe(true);
		if (Array.isArray(result.type)) {
			expect(result.type).toContain("string");
			expect(result.type).toContain("integer");
		}
	});

	test("enum with null → includes null in type array", () => {
		const result = checker.normalize({ enum: ["hello", null] }) as JSONSchema7;
		expect(Array.isArray(result.type)).toBe(true);
		if (Array.isArray(result.type)) {
			expect(result.type).toContain("string");
			expect(result.type).toContain("null");
		}
	});

	test("does NOT overwrite existing type when const is present", () => {
		const result = checker.normalize({
			const: "hello",
			type: "string",
		}) as JSONSchema7;
		expect(result.type).toBe("string");
	});

	test("double negation: not(not(X)) → X", () => {
		const result = checker.normalize({
			not: { not: { type: "string", minLength: 1 } },
		}) as JSONSchema7;

		// Should be simplified to { type: "string", minLength: 1 }
		expect(result.type).toBe("string");
		expect(result.minLength).toBe(1);
		expect(result).not.toHaveProperty("not");
	});

	test("triple negation: not(not(not(X))) → not(X)", () => {
		const result = checker.normalize({
			not: { not: { not: { type: "string" } } },
		}) as JSONSchema7;

		// not(not(not(X))) → not(X) after double negation resolution
		expect(result).toHaveProperty("not");
		if (result.not && typeof result.not !== "boolean") {
			expect((result.not as JSONSchema7).type).toBe("string");
		}
	});

	test("const + enum → strips redundant enum when const ∈ enum", () => {
		const result = checker.normalize({
			const: "a",
			enum: ["a", "b", "c"],
		}) as JSONSchema7;

		// const is more restrictive → enum is redundant
		expect(result.const).toBe("a");
		expect(result).not.toHaveProperty("enum");
	});

	test("const + enum → keeps both when const ∉ enum", () => {
		const result = checker.normalize({
			const: "x",
			enum: ["a", "b", "c"],
		}) as JSONSchema7;

		// const not in enum → both kept (this is actually an impossible schema)
		expect(result.const).toBe("x");
		expect(result.enum).toBeDefined();
	});
});
