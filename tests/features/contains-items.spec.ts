import { beforeAll, describe, expect, test } from "bun:test";
import type { JSONSchema7 } from "json-schema";
import { JsonSchemaCompatibilityChecker } from "../../src";

let checker: JsonSchemaCompatibilityChecker;

beforeAll(() => {
	checker = new JsonSchemaCompatibilityChecker();
});

// ═══════════════════════════════════════════════════════════════════════════════
//  contains & additionalItems — keyword behavior and tuple validation
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
//  11. contains keyword behavior
//
//  Draft 7: { "contains": S } means the array must have AT LEAST one
//  element matching S. Different from items.
// ─────────────────────────────────────────────────────────────────────────────

describe("contains — keyword behavior", () => {
	test("contains is normalized recursively", () => {
		const schema: JSONSchema7 = {
			type: "array",
			contains: { const: 42 },
		};

		const result = checker.normalize(schema) as JSONSchema7;
		if (result.contains && typeof result.contains !== "boolean") {
			// Type should be inferred from const
			expect((result.contains as JSONSchema7).type).toBe("integer");
		}
	});

	test("stricter contains ⊆ looser contains", () => {
		const sub: JSONSchema7 = {
			type: "array",
			contains: { type: "string", minLength: 5 },
		};

		const sup: JSONSchema7 = {
			type: "array",
			contains: { type: "string" },
		};

		expect(checker.isSubset(sub, sup)).toBe(true);
	});

	test("contains ⊆ no contains — contains adds constraint", () => {
		const sub: JSONSchema7 = {
			type: "array",
			contains: { type: "string" },
		};

		const sup: JSONSchema7 = { type: "array" };

		// Sub requires at least one string element → more constrained
		expect(checker.isSubset(sub, sup)).toBe(true);
	});

	test("no contains ⊄ contains — no contains is less constrained", () => {
		const sub: JSONSchema7 = { type: "array" };

		const sup: JSONSchema7 = {
			type: "array",
			contains: { type: "string" },
		};

		expect(checker.isSubset(sub, sup)).toBe(false);
	});

	test("intersect of contains schemas — merge the contains sub-schemas", () => {
		const result = checker.intersect(
			{ type: "array", contains: { type: "string" } },
			{ type: "array", contains: { type: "string", minLength: 3 } },
		);

		expect(result).not.toBeNull();
		if (result && typeof result !== "boolean") {
			const contains = (result as JSONSchema7).contains;
			if (contains && typeof contains !== "boolean") {
				expect(contains).toHaveProperty("minLength", 3);
			}
		}
	});
});

// ─────────────────────────────────────────────────────────────────────────────
//  12. additionalItems behavior
//
//  Only meaningful when items is a tuple (array of schemas).
// ─────────────────────────────────────────────────────────────────────────────

describe("additionalItems — tuple validation", () => {
	test("additionalItems is normalized recursively", () => {
		const schema: JSONSchema7 = {
			type: "array",
			items: [{ type: "string" }, { type: "number" }],
			additionalItems: { const: "extra" },
		};

		const result = checker.normalize(schema) as JSONSchema7;
		if (result.additionalItems && typeof result.additionalItems !== "boolean") {
			expect((result.additionalItems as JSONSchema7).type).toBe("string");
		}
	});

	test("tuple with additionalItems: false ⊆ tuple without additionalItems", () => {
		const sub: JSONSchema7 = {
			type: "array",
			items: [{ type: "string" }, { type: "number" }],
			additionalItems: false,
		};

		const sup: JSONSchema7 = {
			type: "array",
			items: [{ type: "string" }, { type: "number" }],
		};

		// additionalItems: false is more constrained
		expect(checker.isSubset(sub, sup)).toBe(true);
	});

	test("tuple without additionalItems ⊄ tuple with additionalItems: false", () => {
		const sub: JSONSchema7 = {
			type: "array",
			items: [{ type: "string" }, { type: "number" }],
		};

		const sup: JSONSchema7 = {
			type: "array",
			items: [{ type: "string" }, { type: "number" }],
			additionalItems: false,
		};

		// sub allows extra elements, sup doesn't
		expect(checker.isSubset(sub, sup)).toBe(false);
	});

	test("intersect tuples with additionalItems constraints", () => {
		const result = checker.intersect(
			{
				type: "array",
				items: [{ type: "string" }],
				additionalItems: { type: "number" },
			},
			{
				type: "array",
				items: [{ type: "string" }],
				additionalItems: { type: "number", minimum: 0 },
			},
		);

		expect(result).not.toBeNull();
		if (result && typeof result !== "boolean") {
			const addItems = (result as JSONSchema7).additionalItems;
			if (addItems && typeof addItems !== "boolean") {
				expect(addItems).toHaveProperty("minimum", 0);
			}
		}
	});
});
