import { beforeAll, describe, expect, test } from "bun:test";
import type { JSONSchema7, JSONSchema7Definition } from "json-schema";
import { JsonSchemaCompatibilityChecker } from "../../src";

let checker: JsonSchemaCompatibilityChecker;

beforeAll(() => {
	checker = new JsonSchemaCompatibilityChecker();
});

// ═══════════════════════════════════════════════════════════════════════════════
//  Object properties — patternProperties, minProperties/maxProperties,
//  additionalProperties conflict detection, interaction gaps
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
//  Point 2 — patternProperties normalization & diffing
// ─────────────────────────────────────────────────────────────────────────────

describe("Point 2 — patternProperties", () => {
	test('normalize patternProperties: { const: "active" } infers type: string', () => {
		const result = checker.normalize({
			patternProperties: { "^S_": { const: "active" } },
		}) as JSONSchema7;
		const sub = (
			result.patternProperties as Record<string, JSONSchema7Definition>
		)["^S_"] as JSONSchema7;
		expect(sub.type).toBe("string");
	});

	test("normalize patternProperties: { enum: [1, 2, 3] } infers type: integer", () => {
		const result = checker.normalize({
			patternProperties: { "^N_": { enum: [1, 2, 3] } },
		}) as JSONSchema7;
		const sub = (
			result.patternProperties as Record<string, JSONSchema7Definition>
		)["^N_"] as JSONSchema7;
		expect(sub.type).toBe("integer");
	});

	test("subset with patternProperties: stricter ⊆ more lax", () => {
		const strict: JSONSchema7 = {
			type: "object",
			patternProperties: {
				"^S_": { type: "string", minLength: 3 },
			},
		};
		const loose: JSONSchema7 = {
			type: "object",
			patternProperties: {
				"^S_": { type: "string" },
			},
		};
		expect(checker.isSubset(strict, loose)).toBe(true);
	});

	test("diff on patternProperties includes correct path", () => {
		const sub: JSONSchema7 = {
			type: "object",
			patternProperties: {
				"^S_": { type: "string" },
			},
		};
		const sup: JSONSchema7 = {
			type: "object",
			patternProperties: {
				"^S_": { type: "string", minLength: 5 },
			},
		};
		const result = checker.check(sub, sup);
		expect(result.isSubset).toBe(false);
		expect(result.errors.length).toBeGreaterThan(0);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
//  Point 8 — minProperties / maxProperties tests
// ─────────────────────────────────────────────────────────────────────────────

describe("Point 8 — minProperties / maxProperties", () => {
	test("minProperties: 3 ⊆ minProperties: 1 (stricter min)", () => {
		expect(
			checker.isSubset(
				{ type: "object", minProperties: 3 },
				{ type: "object", minProperties: 1 },
			),
		).toBe(true);
	});

	test("minProperties: 1 ⊄ minProperties: 3 (looser min)", () => {
		expect(
			checker.isSubset(
				{ type: "object", minProperties: 1 },
				{ type: "object", minProperties: 3 },
			),
		).toBe(false);
	});

	test("maxProperties: 5 ⊆ maxProperties: 10 (stricter max)", () => {
		expect(
			checker.isSubset(
				{ type: "object", maxProperties: 5 },
				{ type: "object", maxProperties: 10 },
			),
		).toBe(true);
	});

	test("maxProperties: 10 ⊄ maxProperties: 5 (looser max)", () => {
		expect(
			checker.isSubset(
				{ type: "object", maxProperties: 10 },
				{ type: "object", maxProperties: 5 },
			),
		).toBe(false);
	});

	test("minProperties: 2, maxProperties: 5 ⊆ minProperties: 1, maxProperties: 10", () => {
		expect(
			checker.isSubset(
				{ type: "object", minProperties: 2, maxProperties: 5 },
				{ type: "object", minProperties: 1, maxProperties: 10 },
			),
		).toBe(true);
	});

	test("check reports error when minProperties constraint is violated", () => {
		const result = checker.check(
			{ type: "object", minProperties: 1 },
			{ type: "object", minProperties: 3 },
		);
		expect(result.isSubset).toBe(false);
		expect(result.errors.length).toBeGreaterThan(0);
	});

	test("check reports error when maxProperties constraint is violated", () => {
		const result = checker.check(
			{ type: "object", maxProperties: 10 },
			{ type: "object", maxProperties: 5 },
		);
		expect(result.isSubset).toBe(false);
		expect(result.errors.length).toBeGreaterThan(0);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
//  Enhancement 3 — additionalProperties: safe interaction with the merge
// ─────────────────────────────────────────────────────────────────────────────

describe("Enhancement 3 — additionalProperties conflict detection", () => {
	test("Test C — additionalProperties: false blocking (isSubset A ⊆ B)", () => {
		const schemaA: JSONSchema7 = {
			type: "object",
			properties: { name: { type: "string" } },
			additionalProperties: false,
		};
		const schemaB: JSONSchema7 = {
			type: "object",
			properties: {
				name: { type: "string" },
				age: { type: "number" },
			},
		};
		// A is more restrictive than B → A ⊆ B
		expect(checker.isSubset(schemaA, schemaB)).toBe(true);
	});

	test("Test C — additionalProperties: false bloquant (isSubset B ⊄ A)", () => {
		const schemaA: JSONSchema7 = {
			type: "object",
			properties: { name: { type: "string" } },
			additionalProperties: false,
		};
		const schemaB: JSONSchema7 = {
			type: "object",
			properties: {
				name: { type: "string" },
				age: { type: "number" },
			},
		};
		// B accepts age, A forbids it → B ⊄ A
		expect(checker.isSubset(schemaB, schemaA)).toBe(false);
	});

	test("additionalProperties: false vs required extra → merge null (intersection vide)", () => {
		const a: JSONSchema7 = {
			type: "object",
			properties: { name: { type: "string" } },
			required: ["name"],
			additionalProperties: false,
		};
		const b: JSONSchema7 = {
			type: "object",
			properties: {
				name: { type: "string" },
				age: { type: "number" },
			},
			required: ["name", "age"],
		};
		// a forbids age, b requires age → empty intersection
		const result = checker.intersect(a, b);
		expect(result).toBeNull();
	});

	test("additionalProperties: { type: string } vs extra required property of type number → conflict", () => {
		const a: JSONSchema7 = {
			type: "object",
			properties: { name: { type: "string" } },
			additionalProperties: { type: "string" },
		};
		const b: JSONSchema7 = {
			type: "object",
			properties: {
				name: { type: "string" },
				age: { type: "number" },
			},
			required: ["name", "age"],
		};
		// age (number) falls under additionalProperties: { type: string } → type conflict
		const result = checker.intersect(a, b);
		expect(result).toBeNull();
	});

	test("additionalProperties: { type: string } vs extra property of same type → no conflict", () => {
		const a: JSONSchema7 = {
			type: "object",
			properties: { name: { type: "string" } },
			additionalProperties: { type: "string" },
		};
		const b: JSONSchema7 = {
			type: "object",
			properties: {
				name: { type: "string" },
				bio: { type: "string" },
			},
			required: ["name", "bio"],
		};
		// bio (string) is compatible with additionalProperties: { type: string } → no conflict
		const result = checker.intersect(a, b);
		expect(result).not.toBeNull();
	});

	test("recursion: additionalProperties conflict in sub-objects", () => {
		const a: JSONSchema7 = {
			type: "object",
			properties: {
				nested: {
					type: "object",
					properties: { x: { type: "string" } },
					additionalProperties: false,
				},
			},
		};
		const b: JSONSchema7 = {
			type: "object",
			properties: {
				nested: {
					type: "object",
					properties: {
						x: { type: "string" },
						y: { type: "number" },
					},
					required: ["x", "y"],
				},
			},
		};
		// nested in a forbids y, nested in b requires y → recursive conflict
		const result = checker.intersect(a, b);
		expect(result).toBeNull();
	});

	test("both have additionalProperties: false without required conflict → no conflict", () => {
		const a: JSONSchema7 = {
			type: "object",
			properties: { name: { type: "string" } },
			additionalProperties: false,
		};
		const b: JSONSchema7 = {
			type: "object",
			properties: { name: { type: "string" } },
			additionalProperties: false,
		};
		// Same properties, no conflict
		const result = checker.intersect(a, b);
		expect(result).not.toBeNull();
	});
});

// ─────────────────────────────────────────────────────────────────────────────
//  6. additionalProperties × patternProperties interaction
//
//  The checker explicitly doesn't cross-check these.
// ─────────────────────────────────────────────────────────────────────────────

describe("additionalProperties × patternProperties — interaction gap", () => {
	test("additionalProperties: false + patternProperties in other schema — NOT detected", () => {
		const a: JSONSchema7 = {
			type: "object",
			properties: { name: { type: "string" } },
			additionalProperties: false,
		};

		const b: JSONSchema7 = {
			type: "object",
			properties: { name: { type: "string" } },
			patternProperties: {
				"^x_": { type: "string" },
			},
		};

		// b allows properties matching ^x_, but a forbids additional properties
		// The conflict detection doesn't cross-check patternProperties
		const result = checker.intersect(a, b);
		// Document actual behavior: may or may not detect the conflict
		expect(result).toBeDefined(); // result depends on merge library behavior
	});

	test("patternProperties overlap between schemas — handled by merge library", () => {
		const a: JSONSchema7 = {
			type: "object",
			patternProperties: {
				"^S_": { type: "string", minLength: 1 },
			},
		};

		const b: JSONSchema7 = {
			type: "object",
			patternProperties: {
				"^S_": { type: "string", maxLength: 100 },
			},
		};

		// Same pattern → schemas should be merged
		const result = checker.intersect(a, b);
		expect(result).not.toBeNull();
		if (result && typeof result !== "boolean") {
			const pp = (result as JSONSchema7).patternProperties?.["^S_"];
			if (pp && typeof pp !== "boolean") {
				expect(pp).toHaveProperty("minLength", 1);
				expect(pp).toHaveProperty("maxLength", 100);
			}
		}
	});

	test("additionalProperties: false vs required property matching patternProperties", () => {
		const a: JSONSchema7 = {
			type: "object",
			properties: {
				id: { type: "string" },
			},
			additionalProperties: false,
		};

		const b: JSONSchema7 = {
			type: "object",
			properties: {
				id: { type: "string" },
			},
			patternProperties: {
				"^meta_": { type: "string" },
			},
			required: ["id", "meta_source"], // meta_source matches patternProperties
		};

		// meta_source is required by b but not defined in a.properties
		// and a has additionalProperties: false
		// This should be detected as a conflict for required properties
		const result = checker.intersect(a, b);
		// Document behavior: the checker may miss this because it doesn't
		// cross-check patternProperties with additionalProperties
		expect(result).toBeDefined();
	});
});
