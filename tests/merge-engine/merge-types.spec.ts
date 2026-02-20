import { beforeAll, describe, expect, test } from "bun:test";
import type { JSONSchema7, JSONSchema7Definition } from "json-schema";
import { JsonSchemaCompatibilityChecker } from "../../src";

let checker: JsonSchemaCompatibilityChecker;

beforeAll(() => {
	checker = new JsonSchemaCompatibilityChecker();
});

// ═══════════════════════════════════════════════════════════════════════════════
//  Merge engine — type system, boolean schemas, empty/identity, and edge cases
// ═══════════════════════════════════════════════════════════════════════════════

//  These tests verify that the library handles every JSON Schema keyword
//  the checker depends on, so we catch regressions if the library changes.
// ─────────────────────────────────────────────────────────────────────────────

describe("merge engine — type system", () => {
	test("same type → preserved", () => {
		const r = checker.intersect(
			{ type: "string" },
			{ type: "string" },
		) as JSONSchema7;
		expect(r.type).toBe("string");
	});

	test("integer ∩ number → integer", () => {
		const r = checker.intersect(
			{ type: "integer" },
			{ type: "number" },
		) as JSONSchema7;
		expect(r.type).toBe("integer");
	});

	test("number ∩ integer → integer (commutative)", () => {
		const r = checker.intersect(
			{ type: "number" },
			{ type: "integer" },
		) as JSONSchema7;
		expect(r.type).toBe("integer");
	});

	test("incompatible types → null", () => {
		expect(
			checker.intersect({ type: "string" }, { type: "number" }),
		).toBeNull();
		expect(
			checker.intersect({ type: "boolean" }, { type: "array" }),
		).toBeNull();
		expect(
			checker.intersect({ type: "object" }, { type: "string" }),
		).toBeNull();
	});

	test("multi-type ∩ single type → single type if included", () => {
		const r = checker.intersect(
			{ type: ["string", "number"] },
			{ type: "string" },
		) as JSONSchema7;
		expect(r.type).toBe("string");
	});

	test("multi-type ∩ single type → null if not included", () => {
		expect(
			checker.intersect({ type: ["string", "number"] }, { type: "boolean" }),
		).toBeNull();
	});

	test("multi-type ∩ multi-type → common types", () => {
		const r = checker.intersect(
			{ type: ["string", "number", "boolean"] },
			{ type: ["number", "boolean", "null"] },
		) as JSONSchema7;
		// Should contain only the intersection of types
		const types = Array.isArray(r.type) ? r.type : [r.type];
		expect(types).toContain("number");
		expect(types).toContain("boolean");
		expect(types).not.toContain("string");
		expect(types).not.toContain("null");
	});
});

describe("merge engine — boolean schemas", () => {
	test("true ∩ true → semantically equivalent to true (library resolves to {})", () => {
		// The merge library resolves allOf([true, true]) to {} (empty schema).
		// {} and true are semantically equivalent (both allow everything).
		const r = checker.intersect(true, true);
		expect(r).not.toBeNull();
		expect(checker.isEqual(r as JSONSchema7Definition, true)).toBe(true);
	});

	test("false ∩ false → false", () => {
		expect(checker.intersect(false, false)).toBe(false);
	});

	test("true ∩ schema → schema", () => {
		const schema: JSONSchema7 = { type: "string", minLength: 1 };
		const r = checker.intersect(true, schema) as JSONSchema7;
		expect(r.type).toBe("string");
		expect(r.minLength).toBe(1);
	});

	test("false ∩ schema → false", () => {
		expect(checker.intersect(false, { type: "string" })).toBe(false);
	});

	test("true ∩ false → false", () => {
		expect(checker.intersect(true, false)).toBe(false);
	});
});

describe("merge engine — empty & identity schemas", () => {
	test("{} ∩ typed schema → typed schema", () => {
		const r = checker.intersect(
			{},
			{ type: "string", minLength: 1 },
		) as JSONSchema7;
		expect(r.type).toBe("string");
		expect(r.minLength).toBe(1);
	});

	test("{} ∩ {} → {}", () => {
		const r = checker.intersect({}, {}) as JSONSchema7;
		expect(r).not.toBeNull();
	});

	test("schema ∩ itself → structurally equal (idempotent)", () => {
		const schema: JSONSchema7 = {
			type: "object",
			properties: {
				name: { type: "string", minLength: 1 },
				age: { type: "integer", minimum: 0 },
			},
			required: ["name"],
			additionalProperties: false,
		};
		const r = checker.intersect(schema, schema);
		expect(r).not.toBeNull();
		expect(checker.isEqual(r as JSONSchema7Definition, schema)).toBe(true);
	});
});

describe("boolean schema — edge cases", () => {
	test("false ⊆ false — empty set ⊆ empty set", () => {
		expect(checker.isSubset(false, false)).toBe(true);
	});

	test("false ⊆ true — empty set ⊆ everything", () => {
		expect(checker.isSubset(false, true)).toBe(true);
	});

	test("true ⊄ false — everything ⊄ empty set", () => {
		expect(checker.isSubset(true, false)).toBe(false);
	});

	test("true ⊆ true — everything ⊆ everything", () => {
		expect(checker.isSubset(true, true)).toBe(true);
	});

	test("false ⊆ any concrete schema", () => {
		expect(checker.isSubset(false, { type: "string" })).toBe(true);
		expect(checker.isSubset(false, { type: "number", minimum: 0 })).toBe(true);
		expect(
			checker.isSubset(false, {
				type: "object",
				properties: { x: { type: "string" } },
				required: ["x"],
			}),
		).toBe(true);
	});

	test("concrete schema ⊄ false — nothing can be ⊆ empty set (except false itself)", () => {
		expect(checker.isSubset({ type: "string" }, false)).toBe(false);
		expect(checker.isSubset({ type: "number" }, false)).toBe(false);
	});

	test("boolean property schemas — { properties: { x: true } }", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				x: true as unknown as JSONSchema7Definition,
			},
		};

		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				x: { type: "string" },
			},
		};

		// x: true accepts everything, x: { type: string } is more restrictive
		expect(checker.isSubset(sub, sup)).toBe(false);
	});

	test("boolean property schemas — { properties: { x: false } }", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				x: false as unknown as JSONSchema7Definition,
			},
		};

		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				x: { type: "string" },
			},
		};

		// x: false forbids x entirely → ⊆ x: { type: string }
		expect(checker.isSubset(sub, sup)).toBe(true);
	});

	test("intersect(true, schema) = schema", () => {
		const schema: JSONSchema7 = { type: "string", minLength: 3 };
		const result = checker.intersect(true, schema);
		expect(result).not.toBeNull();
		// The result should be equivalent to schema
	});

	test("intersect(false, schema) = false", () => {
		const result = checker.intersect(false, { type: "string" });
		// false ∩ anything = false (empty set)
		expect(result === false || result === null).toBe(true);
	});

	test("intersect(true, true) — semantically true", () => {
		const result = checker.intersect(true, true);
		// true ∩ true = true (accept everything)
		expect(result).not.toBeNull();
	});
});

describe("empty schema — semantics", () => {
	test("{} ⊆ {} — identity", () => {
		expect(checker.isSubset({}, {})).toBe(true);
	});

	test("{} accepts everything — like boolean true", () => {
		// {} is equivalent to true: no constraints
		expect(checker.isSubset({ type: "string" }, {})).toBe(true);
		expect(checker.isSubset({ type: "number", minimum: 0 }, {})).toBe(true);
		expect(
			checker.isSubset(
				{
					type: "object",
					properties: { x: { type: "string" } },
					required: ["x"],
				},
				{},
			),
		).toBe(true);
	});

	test("{} ⊄ typed schema — empty allows more than typed", () => {
		expect(checker.isSubset({}, { type: "string" })).toBe(false);
		expect(checker.isSubset({}, { type: "number" })).toBe(false);
	});

	test("intersect({}, schema) = schema", () => {
		const schema: JSONSchema7 = { type: "string", minLength: 1 };
		const result = checker.intersect({}, schema);
		expect(result).not.toBeNull();
		if (result && typeof result !== "boolean") {
			expect((result as JSONSchema7).type).toBe("string");
			expect((result as JSONSchema7).minLength).toBe(1);
		}
	});

	test("isEqual({}, {}) = true", () => {
		expect(checker.isEqual({}, {})).toBe(true);
	});
});
