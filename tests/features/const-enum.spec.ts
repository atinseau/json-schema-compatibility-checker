import { beforeAll, describe, expect, test } from "bun:test";
import type { JSONSchema7 } from "json-schema";
import { JsonSchemaCompatibilityChecker } from "../../src";

let checker: JsonSchemaCompatibilityChecker;

beforeAll(() => {
	checker = new JsonSchemaCompatibilityChecker();
});

// ═══════════════════════════════════════════════════════════════════════════════
//  const & enum — conflict detection, deep conflicts, normalization, subset
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
//  Point 1 — const conflict detection
// ─────────────────────────────────────────────────────────────────────────────

describe("Point 1 — const conflict detection", () => {
	test('{ const: "a" } ⊄ { const: "b" }', () => {
		expect(checker.isSubset({ const: "a" }, { const: "b" })).toBe(false);
	});

	test("{ const: 1 } ⊄ { const: 2 }", () => {
		expect(checker.isSubset({ const: 1 }, { const: 2 })).toBe(false);
	});

	test("{ const: { x: 1 } } ⊄ { const: { x: 2 } } (deep comparison)", () => {
		expect(checker.isSubset({ const: { x: 1 } }, { const: { x: 2 } })).toBe(
			false,
		);
	});

	test("{ const: [1, 2] } ⊄ { const: [1, 3] }", () => {
		expect(checker.isSubset({ const: [1, 2] }, { const: [1, 3] })).toBe(false);
	});

	test("{ const: { x: 1 } } ⊆ { const: { x: 1 } } (same object value)", () => {
		expect(checker.isSubset({ const: { x: 1 } }, { const: { x: 1 } })).toBe(
			true,
		);
	});

	test("{ const: null } ⊄ { const: 0 }", () => {
		expect(checker.isSubset({ const: null }, { const: 0 })).toBe(false);
	});

	test('intersect({ const: "a" }, { const: "b" }) → null', () => {
		const result = checker.intersect({ const: "a" }, { const: "b" });
		expect(result).toBeNull();
	});

	test('check({ const: "a" }, { const: "b" }) returns isSubset: false with diff', () => {
		const result = checker.check({ const: "a" }, { const: "b" });
		expect(result.isSubset).toBe(false);
	});

	test('{ const: "x" } ⊄ { enum: ["y", "z"] } (const not in enum)', () => {
		expect(checker.isSubset({ const: "x" }, { enum: ["y", "z"] })).toBe(false);
	});

	test('{ const: "x" } ⊆ { enum: ["x", "y"] } (const value is in enum)', () => {
		// The merge produces { const: "x", type: "string", enum: ["x", "y"] }.
		// Post-merge normalization strips the redundant `enum` (since const ∈ enum),
		// leaving { const: "x", type: "string" } which equals normalized sub.
		expect(checker.isSubset({ const: "x" }, { enum: ["x", "y"] })).toBe(true);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
//  Point 1b — deep const conflict detection (items, additionalProperties, etc.)
// ─────────────────────────────────────────────────────────────────────────────

describe("Point 1b — deep const conflict in sub-schemas", () => {
	test("items (single schema): conflicting const → null", () => {
		expect(
			checker.intersect(
				{ type: "array", items: { const: "a" } },
				{ type: "array", items: { const: "b" } },
			),
		).toBeNull();
	});

	test("items (single schema): same const → not null", () => {
		expect(
			checker.intersect(
				{ type: "array", items: { const: "a" } },
				{ type: "array", items: { const: "a" } },
			),
		).not.toBeNull();
	});

	test("additionalProperties: conflicting const → null", () => {
		expect(
			checker.intersect(
				{ type: "object", additionalProperties: { const: 1 } },
				{ type: "object", additionalProperties: { const: 2 } },
			),
		).toBeNull();
	});

	test("patternProperties: conflicting const on same pattern → null", () => {
		expect(
			checker.intersect(
				{ type: "object", patternProperties: { "^S_": { const: "x" } } },
				{ type: "object", patternProperties: { "^S_": { const: "y" } } },
			),
		).toBeNull();
	});

	test("patternProperties: different patterns → not null (no conflict)", () => {
		expect(
			checker.intersect(
				{ type: "object", patternProperties: { "^A_": { const: "x" } } },
				{ type: "object", patternProperties: { "^B_": { const: "y" } } },
			),
		).not.toBeNull();
	});

	test("tuple items: conflicting const at same index → null", () => {
		expect(
			checker.intersect(
				{ type: "array", items: [{ const: 1 }, { const: 2 }] },
				{ type: "array", items: [{ const: 1 }, { const: 3 }] },
			),
		).toBeNull();
	});

	test("tuple items: same const values → not null", () => {
		expect(
			checker.intersect(
				{ type: "array", items: [{ const: 1 }, { const: 2 }] },
				{ type: "array", items: [{ const: 1 }, { const: 2 }] },
			),
		).not.toBeNull();
	});

	test("nested properties → items: conflicting const detected recursively", () => {
		expect(
			checker.intersect(
				{
					type: "object",
					properties: { tags: { type: "array", items: { const: "a" } } },
				},
				{
					type: "object",
					properties: { tags: { type: "array", items: { const: "b" } } },
				},
			),
		).toBeNull();
	});

	test("isSubset detects deep const conflict in items", () => {
		expect(
			checker.isSubset(
				{ type: "array", items: { const: "a" } },
				{ type: "array", items: { const: "b" } },
			),
		).toBe(false);
	});

	test("isSubset detects deep const conflict in additionalProperties", () => {
		expect(
			checker.isSubset(
				{ type: "object", additionalProperties: { const: 1 } },
				{ type: "object", additionalProperties: { const: 2 } },
			),
		).toBe(false);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
//  Point 1c — const ⊆ enum normalization
// ─────────────────────────────────────────────────────────────────────────────

describe("Point 1c — const ⊆ enum post-merge normalization", () => {
	test("normalize strips redundant enum when const is present and const ∈ enum", () => {
		const result = checker.normalize({
			const: "x",
			enum: ["x", "y"],
		}) as JSONSchema7;
		expect(result.const).toBe("x");
		expect(result.enum).toBeUndefined();
		expect(result.type).toBe("string");
	});

	test("normalize keeps enum when const is absent", () => {
		const result = checker.normalize({
			enum: ["x", "y"],
		}) as JSONSchema7;
		expect(result.enum).toEqual(["x", "y"]);
	});

	test("{ const: 1 } ⊆ { enum: [1, 2, 3] }", () => {
		expect(checker.isSubset({ const: 1 }, { enum: [1, 2, 3] })).toBe(true);
	});

	test("{ const: { a: 1 } } ⊆ { enum: [{ a: 1 }, { a: 2 }] } (deep equal)", () => {
		expect(
			checker.isSubset({ const: { a: 1 } }, { enum: [{ a: 1 }, { a: 2 }] }),
		).toBe(true);
	});

	test("nested: { properties: { x: { const: 'a' } } } ⊆ { properties: { x: { enum: ['a', 'b'] } } }", () => {
		expect(
			checker.isSubset(
				{ type: "object", properties: { x: { const: "a" } } },
				{ type: "object", properties: { x: { enum: ["a", "b"] } } },
			),
		).toBe(true);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
//  15. enum-vs-enum subset behavior
//
//  Test enum containment relationships.
// ─────────────────────────────────────────────────────────────────────────────

describe("enum-vs-enum — subset behavior", () => {
	test("[1, 2] ⊆ [1, 2, 3] — strict subset", () => {
		const sub: JSONSchema7 = { enum: [1, 2] };
		const sup: JSONSchema7 = { enum: [1, 2, 3] };
		expect(checker.isSubset(sub, sup)).toBe(true);
	});

	test("[1, 2, 3] ⊄ [1, 2] — superset is not subset", () => {
		const sub: JSONSchema7 = { enum: [1, 2, 3] };
		const sup: JSONSchema7 = { enum: [1, 2] };
		expect(checker.isSubset(sub, sup)).toBe(false);
	});

	test("disjoint enums — neither is subset", () => {
		const a: JSONSchema7 = { enum: [1, 2] };
		const b: JSONSchema7 = { enum: [3, 4] };
		expect(checker.isSubset(a, b)).toBe(false);
		expect(checker.isSubset(b, a)).toBe(false);
	});

	test("disjoint enums — intersect returns null", () => {
		const result = checker.intersect({ enum: [1, 2] }, { enum: [3, 4] });
		expect(result).toBeNull();
	});

	test("overlapping enums — intersect returns common values", () => {
		const result = checker.intersect({ enum: [1, 2, 3] }, { enum: [2, 3, 4] });
		expect(result).not.toBeNull();
		if (result && typeof result !== "boolean") {
			expect((result as JSONSchema7).enum).toEqual([2, 3]);
		}
	});

	test("enum with objects — deep equality for subset", () => {
		const sub: JSONSchema7 = { enum: [{ a: 1 }] };
		const sup: JSONSchema7 = { enum: [{ a: 1 }, { a: 2 }] };
		expect(checker.isSubset(sub, sup)).toBe(true);
	});

	test("enum with null — nullable enum subset (FIXED)", () => {
		const sub: JSONSchema7 = { enum: ["a", null] };
		const sup: JSONSchema7 = { enum: ["a", "b", null] };
		// FIXED: The library's compareSchemaValues returned -1 for compare(null, null)
		// instead of 0, causing createIntersector to drop null during enum intersection.
		// Fix: wrapped compareSchemaValues with a null-safe version in MergeEngine.
		expect(checker.isSubset(sub, sup)).toBe(true);
	});

	test("enum with mixed types — subset check", () => {
		const sub: JSONSchema7 = { enum: ["hello", 42] };
		const sup: JSONSchema7 = { enum: ["hello", 42, true, null] };
		expect(checker.isSubset(sub, sup)).toBe(true);
	});

	test("single-value enum ≡ const — subset behavior (FIXED)", () => {
		const enumSchema: JSONSchema7 = { enum: ["only"] };
		const constSchema: JSONSchema7 = { const: "only" };

		// FIXED: The normalizer now converts single-element enum to const:
		//   { enum: ["only"] } → { const: "only", type: "string" }
		// This makes both schemas structurally identical after normalization,
		// so isEqual succeeds in both directions.
		expect(checker.isSubset(enumSchema, constSchema)).toBe(true);

		// Reverse direction still works
		expect(checker.isSubset(constSchema, enumSchema)).toBe(true);
	});
});
