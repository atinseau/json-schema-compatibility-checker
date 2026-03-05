import { beforeAll, describe, expect, test } from "bun:test";
import type { JSONSchema7 } from "json-schema";
import { JsonSchemaCompatibilityChecker } from "../../src";

let checker: JsonSchemaCompatibilityChecker;

beforeAll(() => {
	checker = new JsonSchemaCompatibilityChecker();
});

// ═══════════════════════════════════════════════════════════════════════════════
//  Nested oneOf/anyOf in object properties
//
//  These tests verify that oneOf/anyOf works correctly when nested inside
//  object properties, not just at the top level. The core issue is that
//  MergeEngine.merge() delegates to @x0k/json-schema-merge which cannot
//  distribute allOf over oneOf/anyOf, causing false negatives.
// ═══════════════════════════════════════════════════════════════════════════════

// ── Scenario A — Identical oneOf/anyOf on both sides ─────────────────────────

describe("Nested branching — identical schemas on both sides", () => {
	test("obj{ result: oneOf(string, number) } ⊆ obj{ result: oneOf(string, number) }", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				result: { oneOf: [{ type: "string" }, { type: "number" }] },
			},
			required: ["result"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				result: { oneOf: [{ type: "string" }, { type: "number" }] },
			},
			required: ["result"],
		};
		expect(checker.isSubset(sub, sup)).toBe(true);
	});

	test("obj{ result: anyOf(string, number) } ⊆ obj{ result: anyOf(string, number) }", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				result: { anyOf: [{ type: "string" }, { type: "number" }] },
			},
			required: ["result"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				result: { anyOf: [{ type: "string" }, { type: "number" }] },
			},
			required: ["result"],
		};
		expect(checker.isSubset(sub, sup)).toBe(true);
	});

	test("obj{ a: oneOf(s,n), b: oneOf(bool,null) } ⊆ same", () => {
		const schema: JSONSchema7 = {
			type: "object",
			properties: {
				a: { oneOf: [{ type: "string" }, { type: "number" }] },
				b: { oneOf: [{ type: "boolean" }, { type: "null" }] },
			},
			required: ["a", "b"],
		};
		expect(checker.isSubset(schema, schema)).toBe(true);
	});
});

// ── Scenario B — Concrete type ⊆ oneOf/anyOf ────────────────────────────────

describe("Nested branching — concrete type ⊆ oneOf/anyOf", () => {
	test("obj{ payload: string } ⊆ obj{ payload: oneOf(string, number) }", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				payload: { type: "string" },
			},
			required: ["payload"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				payload: { oneOf: [{ type: "string" }, { type: "number" }] },
			},
			required: ["payload"],
		};
		expect(checker.isSubset(sub, sup)).toBe(true);
	});

	test("obj{ payload: string } ⊆ obj{ payload: anyOf(string, number) }", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				payload: { type: "string" },
			},
			required: ["payload"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				payload: { anyOf: [{ type: "string" }, { type: "number" }] },
			},
			required: ["payload"],
		};
		expect(checker.isSubset(sub, sup)).toBe(true);
	});

	test("obj{ score: number } ⊆ obj{ score: anyOf(number, string) }", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				score: { type: "number" },
			},
			required: ["score"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				score: { anyOf: [{ type: "number" }, { type: "string" }] },
			},
			required: ["score"],
		};
		expect(checker.isSubset(sub, sup)).toBe(true);
	});

	test("obj{ flag: boolean } ⊆ obj{ flag: oneOf(boolean, null) }", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				flag: { type: "boolean" },
			},
			required: ["flag"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				flag: { oneOf: [{ type: "boolean" }, { type: "null" }] },
			},
			required: ["flag"],
		};
		expect(checker.isSubset(sub, sup)).toBe(true);
	});
});

// ── Scenario C — integer ⊆ anyOf(number, null) ──────────────────────────────

describe("Nested branching — integer ⊂ number subtyping", () => {
	test("obj{ retry: integer } ⊆ obj{ retry: anyOf(number, null) }", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				retryCount: { type: "integer" },
			},
			required: ["retryCount"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				retryCount: { anyOf: [{ type: "number" }, { type: "null" }] },
			},
			required: ["retryCount"],
		};
		expect(checker.isSubset(sub, sup)).toBe(true);
	});

	test("obj{ count: integer } ⊆ obj{ count: oneOf(number, string) }", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				count: { type: "integer" },
			},
			required: ["count"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				count: { oneOf: [{ type: "number" }, { type: "string" }] },
			},
			required: ["count"],
		};
		expect(checker.isSubset(sub, sup)).toBe(true);
	});
});

// ── Scenario D — Nested in array items ───────────────────────────────────────

describe("Nested branching — inside array items", () => {
	test("obj{ items: array<string> } ⊆ obj{ items: array<oneOf(string, number)> }", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				items: {
					type: "array",
					items: { type: "string" },
				},
			},
			required: ["items"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				items: {
					type: "array",
					items: { oneOf: [{ type: "string" }, { type: "number" }] },
				},
			},
			required: ["items"],
		};
		expect(checker.isSubset(sub, sup)).toBe(true);
	});

	test("obj{ items: array<oneOf(s,n)> } ⊆ obj{ items: array<oneOf(s,n)> }", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				items: {
					type: "array",
					items: { oneOf: [{ type: "string" }, { type: "number" }] },
				},
			},
			required: ["items"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				items: {
					type: "array",
					items: { oneOf: [{ type: "string" }, { type: "number" }] },
				},
			},
			required: ["items"],
		};
		expect(checker.isSubset(sub, sup)).toBe(true);
	});
});

// ── Scenario E — oneOf sub ⊆ oneOf sup (sub branches are subset of sup) ─────

describe("Nested branching — sub branches ⊆ sup branches", () => {
	test("obj{ v: oneOf(string) } ⊆ obj{ v: oneOf(string, number) }", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				v: { oneOf: [{ type: "string" }] },
			},
			required: ["v"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				v: { oneOf: [{ type: "string" }, { type: "number" }] },
			},
			required: ["v"],
		};
		expect(checker.isSubset(sub, sup)).toBe(true);
	});

	test("obj{ v: anyOf(s,n) } ⊄ obj{ v: anyOf(string) } — sup is narrower", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				v: { anyOf: [{ type: "string" }, { type: "number" }] },
			},
			required: ["v"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				v: { anyOf: [{ type: "string" }] },
			},
			required: ["v"],
		};
		expect(checker.isSubset(sub, sup)).toBe(false);
	});
});

// ── Scenario F — Negative cases (should remain false) ────────────────────────

describe("Nested branching — negative cases (must stay false)", () => {
	test("obj{ v: boolean } ⊄ obj{ v: oneOf(string, number) }", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				v: { type: "boolean" },
			},
			required: ["v"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				v: { oneOf: [{ type: "string" }, { type: "number" }] },
			},
			required: ["v"],
		};
		expect(checker.isSubset(sub, sup)).toBe(false);
	});

	test("obj{ v: oneOf(s,n,bool) } ⊄ obj{ v: oneOf(s,n) } — extra branch", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				v: {
					oneOf: [{ type: "string" }, { type: "number" }, { type: "boolean" }],
				},
			},
			required: ["v"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				v: { oneOf: [{ type: "string" }, { type: "number" }] },
			},
			required: ["v"],
		};
		expect(checker.isSubset(sub, sup)).toBe(false);
	});

	test("obj{ v: string } ⊄ obj{ v: oneOf(number, boolean) } — type mismatch", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				v: { type: "string" },
			},
			required: ["v"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				v: { oneOf: [{ type: "number" }, { type: "boolean" }] },
			},
			required: ["v"],
		};
		expect(checker.isSubset(sub, sup)).toBe(false);
	});
});

// ── Scenario G — Multiple properties with mixed branching ────────────────────

describe("Nested branching — multiple properties", () => {
	test("obj{ a: string, b: number } ⊆ obj{ a: oneOf(s,n), b: anyOf(n,null) }", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				a: { type: "string" },
				b: { type: "number" },
			},
			required: ["a", "b"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				a: { oneOf: [{ type: "string" }, { type: "number" }] },
				b: { anyOf: [{ type: "number" }, { type: "null" }] },
			},
			required: ["a", "b"],
		};
		expect(checker.isSubset(sub, sup)).toBe(true);
	});

	test("obj{ a: string, b: boolean } ⊄ obj{ a: oneOf(s,n), b: anyOf(n,null) } — b mismatch", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				a: { type: "string" },
				b: { type: "boolean" },
			},
			required: ["a", "b"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				a: { oneOf: [{ type: "string" }, { type: "number" }] },
				b: { anyOf: [{ type: "number" }, { type: "null" }] },
			},
			required: ["a", "b"],
		};
		expect(checker.isSubset(sub, sup)).toBe(false);
	});
});

// ── Scenario H — Deeply nested (object > object > oneOf) ────────────────────

describe("Nested branching — deeply nested objects", () => {
	test("obj{ nested: obj{ v: string } } ⊆ obj{ nested: obj{ v: oneOf(s,n) } }", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				nested: {
					type: "object",
					properties: {
						v: { type: "string" },
					},
					required: ["v"],
				},
			},
			required: ["nested"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				nested: {
					type: "object",
					properties: {
						v: { oneOf: [{ type: "string" }, { type: "number" }] },
					},
					required: ["v"],
				},
			},
			required: ["nested"],
		};
		expect(checker.isSubset(sub, sup)).toBe(true);
	});
});

// ── Scenario I — check() should return isSubset: true with errors: [] ────────

describe("Nested branching — check() API", () => {
	test("check() returns isSubset: true for obj{ v: string } ⊆ obj{ v: oneOf(s,n) }", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				v: { type: "string" },
			},
			required: ["v"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				v: { oneOf: [{ type: "string" }, { type: "number" }] },
			},
			required: ["v"],
		};
		const result = checker.check(sub, sup);
		expect(result.isSubset).toBe(true);
		expect(result.errors).toEqual([]);
	});

	test("check() returns isSubset: true for identical nested oneOf", () => {
		const schema: JSONSchema7 = {
			type: "object",
			properties: {
				result: { oneOf: [{ type: "string" }, { type: "number" }] },
			},
			required: ["result"],
		};
		const result = checker.check(schema, schema);
		expect(result.isSubset).toBe(true);
		expect(result.errors).toEqual([]);
	});
});

// ── Scenario J — oneOf/anyOf with constrained branches ───────────────────────

describe("Nested branching — constrained branches", () => {
	test("obj{ v: {type:string, minLength:3} } ⊆ obj{ v: oneOf({type:string}, {type:number}) }", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				v: { type: "string", minLength: 3 },
			},
			required: ["v"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				v: { oneOf: [{ type: "string" }, { type: "number" }] },
			},
			required: ["v"],
		};
		expect(checker.isSubset(sub, sup)).toBe(true);
	});

	test("obj{ v: {type:string, minLength:3} } ⊆ obj{ v: anyOf({type:string, minLength:1}, {type:number}) }", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				v: { type: "string", minLength: 3 },
			},
			required: ["v"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				v: {
					anyOf: [{ type: "string", minLength: 1 }, { type: "number" }],
				},
			},
			required: ["v"],
		};
		expect(checker.isSubset(sub, sup)).toBe(true);
	});
});
