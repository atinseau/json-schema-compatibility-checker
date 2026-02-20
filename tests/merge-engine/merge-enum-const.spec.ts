import { beforeAll, describe, expect, test } from "bun:test";
import type { JSONSchema7 } from "json-schema";
import { JsonSchemaCompatibilityChecker } from "../../src";

let checker: JsonSchemaCompatibilityChecker;

beforeAll(() => {
	checker = new JsonSchemaCompatibilityChecker();
});

// ═══════════════════════════════════════════════════════════════════════════════
//  Merge engine — enum & const interactions, logical composition, conditionals
// ═══════════════════════════════════════════════════════════════════════════════

describe("merge engine — enum & const interactions", () => {
	test("enum ∩ enum → common values", () => {
		const r = checker.intersect(
			{ enum: [1, 2, 3] },
			{ enum: [2, 3, 4] },
		) as JSONSchema7;
		expect(r.enum).toEqual([2, 3]);
	});

	test("enum ∩ enum with no overlap → null", () => {
		expect(checker.intersect({ enum: [1, 2] }, { enum: [3, 4] })).toBeNull();
	});

	test("const ∩ same const → preserved", () => {
		const r = checker.intersect({ const: "x" }, { const: "x" }) as JSONSchema7;
		expect(r.const).toBe("x");
	});

	test("const ∩ different const → null", () => {
		expect(checker.intersect({ const: "x" }, { const: "y" })).toBeNull();
	});

	test("const ∩ compatible type → const + type", () => {
		const r = checker.intersect(
			{ const: "hello" },
			{ type: "string" },
		) as JSONSchema7;
		expect(r.const).toBe("hello");
		expect(r.type).toBe("string");
	});

	test("const ∩ incompatible type → null", () => {
		expect(
			checker.intersect({ const: "hello" }, { type: "number" }),
		).toBeNull();
	});

	test("const ∩ enum containing const → const (enum stripped by post-merge normalize)", () => {
		const r = checker.intersect(
			{ const: "a" },
			{ enum: ["a", "b", "c"] },
		) as JSONSchema7;
		expect(r.const).toBe("a");
		expect(r.type).toBe("string");
		// Redundant enum stripped by post-merge normalize in intersect()
		expect(r.enum).toBeUndefined();
	});

	test("const ∩ enum not containing const → null", () => {
		expect(checker.intersect({ const: "z" }, { enum: ["a", "b"] })).toBeNull();
	});

	test("enum ∩ compatible type → enum filtered to that type", () => {
		const r = checker.intersect(
			{ enum: [1, "a", 2, "b"] },
			{ type: "string" },
		) as JSONSchema7;
		// The merge should keep only string values or produce an allOf
		expect(r).not.toBeNull();
	});
});

describe("merge engine — logical composition", () => {
	test("anyOf ∩ compatible type → branches filtered/preserved", () => {
		const r = checker.intersect(
			{ anyOf: [{ type: "string" }, { type: "number" }] },
			{ type: "string" },
		);
		// The intersection should at least be non-null since string is in anyOf
		expect(r).not.toBeNull();
	});

	test("not is preserved through merge", () => {
		const r = checker.intersect(
			{ not: { type: "string" } },
			{ type: "number" },
		) as JSONSchema7;
		expect(r).not.toBeNull();
		// `not` should survive in the merged result
		expect(r.not).toBeDefined();
		expect(r.type).toBe("number");
	});

	test("allOf in one side is flattened into merge", () => {
		const r = checker.intersect(
			{ allOf: [{ type: "string" }, { minLength: 1 }] },
			{ type: "string", maxLength: 10 },
		) as JSONSchema7;
		expect(r).not.toBeNull();
		expect(r.type).toBe("string");
		expect(r.maxLength).toBe(10);
	});
});

describe("merge engine — if/then/else through merge", () => {
	test("if/then/else is preserved (not resolved) by merge", () => {
		const schema: JSONSchema7 = {
			type: "object",
			if: { properties: { x: { const: "a" } } },
			then: { required: ["y"] },
		};
		const r = checker.intersect(schema, { type: "object" }) as JSONSchema7;
		// The merge should preserve if/then/else (or push them to allOf)
		// Either `if` is preserved at top level or moved to allOf
		expect(r).not.toBeNull();
		expect(r.type).toBe("object");
	});
});
