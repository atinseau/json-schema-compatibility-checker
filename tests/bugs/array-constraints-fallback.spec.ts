import { beforeAll, describe, expect, test } from "bun:test";
import type { JSONSchema7 } from "json-schema";
import { JsonSchemaCompatibilityChecker } from "../../src";

let checker: JsonSchemaCompatibilityChecker;

beforeAll(() => {
	checker = new JsonSchemaCompatibilityChecker();
});

describe("array constraints in nested branching fallback", () => {
	// ── maxItems violations ──────────────────────────────────────────────

	test("oneOf in items — sub.maxItems: 2 ⊄ sup.maxItems: 1", () => {
		const sub: JSONSchema7 = {
			type: "array",
			items: {
				oneOf: [{ type: "string" }, { type: "string", const: "extra" }],
			},
			minItems: 2,
			maxItems: 2,
		};
		const sup: JSONSchema7 = {
			type: "array",
			items: { type: "string" },
			maxItems: 1,
		};
		expect(checker.check(sub, sup).isSubset).toBe(false);
	});

	test("anyOf in items — sub.maxItems: 5 ⊄ sup.maxItems: 3", () => {
		const sub: JSONSchema7 = {
			type: "array",
			items: { anyOf: [{ type: "number" }, { type: "integer" }] },
			maxItems: 5,
		};
		const sup: JSONSchema7 = {
			type: "array",
			items: { type: "number" },
			maxItems: 3,
		};
		expect(checker.check(sub, sup).isSubset).toBe(false);
	});

	// ── minItems violations ──────────────────────────────────────────────

	test("oneOf in items — sub.minItems: 2 ⊄ sup.minItems: 3", () => {
		const sub: JSONSchema7 = {
			type: "array",
			items: {
				oneOf: [{ type: "string" }, { type: "string", const: "hello" }],
			},
			minItems: 2,
			maxItems: 2,
		};
		const sup: JSONSchema7 = {
			type: "array",
			items: { type: "string" },
			minItems: 3,
		};
		expect(checker.check(sub, sup).isSubset).toBe(false);
	});

	test("oneOf in items — sub has no minItems ⊄ sup.minItems: 1", () => {
		const sub: JSONSchema7 = {
			type: "array",
			items: { oneOf: [{ type: "string" }, { type: "string", const: "a" }] },
		};
		const sup: JSONSchema7 = {
			type: "array",
			items: { type: "string" },
			minItems: 1,
		};
		expect(checker.check(sub, sup).isSubset).toBe(false);
	});

	// ── uniqueItems violations ───────────────────────────────────────────

	test("oneOf in items — sup.uniqueItems: true, sub.uniqueItems: undefined ⊄ sup", () => {
		const sub: JSONSchema7 = {
			type: "array",
			items: { oneOf: [{ type: "string" }, { type: "string", const: "x" }] },
		};
		const sup: JSONSchema7 = {
			type: "array",
			items: { type: "string" },
			uniqueItems: true,
		};
		expect(checker.check(sub, sup).isSubset).toBe(false);
	});

	// ── Constraints satisfied (should still pass) ────────────────────────

	test("oneOf in items — sub.minItems: 2 ⊆ sup.minItems: 1", () => {
		const sub: JSONSchema7 = {
			type: "array",
			items: { oneOf: [{ type: "string" }, { type: "string", const: "ok" }] },
			minItems: 2,
		};
		const sup: JSONSchema7 = {
			type: "array",
			items: { type: "string" },
			minItems: 1,
		};
		expect(checker.check(sub, sup).isSubset).toBe(true);
	});

	test("oneOf in items — no constraints in sup ⊆ (unrestricted)", () => {
		const sub: JSONSchema7 = {
			type: "array",
			items: { oneOf: [{ type: "string" }, { type: "string", const: "ok" }] },
			minItems: 2,
			maxItems: 5,
		};
		const sup: JSONSchema7 = {
			type: "array",
			items: { type: "string" },
		};
		expect(checker.check(sub, sup).isSubset).toBe(true);
	});

	test("oneOf in items — sub.uniqueItems: true ⊆ sup.uniqueItems: true", () => {
		const sub: JSONSchema7 = {
			type: "array",
			items: { oneOf: [{ type: "string" }, { type: "string", const: "ok" }] },
			uniqueItems: true,
		};
		const sup: JSONSchema7 = {
			type: "array",
			items: { type: "string" },
			uniqueItems: true,
		};
		expect(checker.check(sub, sup).isSubset).toBe(true);
	});

	// ── Nested array property in object ──────────────────────────────────

	test("object property with array items oneOf — maxItems violation ⊄", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				tags: {
					type: "array",
					items: {
						oneOf: [{ type: "string" }, { type: "string", const: "tag" }],
					},
					maxItems: 10,
				},
			},
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				tags: {
					type: "array",
					items: { type: "string" },
					maxItems: 5,
				},
			},
		};
		expect(checker.check(sub, sup).isSubset).toBe(false);
	});

	// ── oneOf in items on both sides ─────────────────────────────────────

	test("oneOf in items on both sides — maxItems violation ⊄", () => {
		const sub: JSONSchema7 = {
			type: "array",
			items: { oneOf: [{ type: "string" }, { type: "number" }] },
			maxItems: 5,
		};
		const sup: JSONSchema7 = {
			type: "array",
			items: { oneOf: [{ type: "string" }, { type: "number" }] },
			maxItems: 3,
		};
		expect(checker.check(sub, sup).isSubset).toBe(false);
	});

	// ── Regression: merge-based path still works ─────────────────────────

	test("no oneOf — merge-based path detects maxItems violation", () => {
		const sub: JSONSchema7 = {
			type: "array",
			items: { type: "string" },
			minItems: 2,
			maxItems: 2,
		};
		const sup: JSONSchema7 = {
			type: "array",
			items: { type: "string" },
			maxItems: 1,
		};
		expect(checker.check(sub, sup).isSubset).toBe(false);
	});

	test("no oneOf — merge-based path accepts valid subset", () => {
		const sub: JSONSchema7 = {
			type: "array",
			items: { type: "string" },
			minItems: 2,
			maxItems: 3,
		};
		const sup: JSONSchema7 = {
			type: "array",
			items: { type: "string" },
			minItems: 1,
			maxItems: 5,
		};
		expect(checker.check(sub, sup).isSubset).toBe(true);
	});
});
