import { beforeAll, describe, expect, test } from "bun:test";
import type { JSONSchema7 } from "json-schema";
import { JsonSchemaCompatibilityChecker } from "../../src";

let checker: JsonSchemaCompatibilityChecker;

beforeAll(() => {
	checker = new JsonSchemaCompatibilityChecker();
});

// ═══════════════════════════════════════════════════════════════════════════════
//  Bug fix — stripRedundantBoundsFromSup property recursion
//
//  The function only stripped redundant inclusive/exclusive bounds at the
//  top level. When numeric bounds lived on nested properties (e.g.
//  properties.score.exclusiveMinimum vs properties.score.minimum), the
//  stripping was skipped, causing the merge engine to copy the sup bound
//  into the merged result, making deepEqual(merged, sub) fail → false
//  negative (isSubset: false when it should be true).
// ═══════════════════════════════════════════════════════════════════════════════

describe("stripRedundantBoundsFromSup — property recursion", () => {
	// ── exclusiveMinimum vs minimum ──────────────────────────────────────

	test("nested: exclusiveMinimum: 5 ⊆ minimum: 5 — (5, +∞) ⊂ [5, +∞)", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: { score: { type: "number", exclusiveMinimum: 5 } },
			required: ["score"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: { score: { type: "number", minimum: 5 } },
			required: ["score"],
		};
		expect(checker.isSubset(sub, sup)).toBe(true);
	});

	test("nested: minimum: 6 ⊆ exclusiveMinimum: 5 — [6, +∞) ⊂ (5, +∞)", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: { score: { type: "number", minimum: 6 } },
			required: ["score"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: { score: { type: "number", exclusiveMinimum: 5 } },
			required: ["score"],
		};
		expect(checker.isSubset(sub, sup)).toBe(true);
	});

	test("nested: minimum: 5 ⊄ exclusiveMinimum: 5 — [5, +∞) ⊄ (5, +∞)", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: { score: { type: "number", minimum: 5 } },
			required: ["score"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: { score: { type: "number", exclusiveMinimum: 5 } },
			required: ["score"],
		};
		expect(checker.isSubset(sub, sup)).toBe(false);
	});

	// ── exclusiveMaximum vs maximum ─────────────────────────────────────

	test("nested: exclusiveMaximum: 100 ⊆ maximum: 100 — (-∞, 100) ⊂ (-∞, 100]", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: { score: { type: "number", exclusiveMaximum: 100 } },
			required: ["score"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: { score: { type: "number", maximum: 100 } },
			required: ["score"],
		};
		expect(checker.isSubset(sub, sup)).toBe(true);
	});

	test("nested: maximum: 99 ⊆ exclusiveMaximum: 100 — (-∞, 99] ⊂ (-∞, 100)", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: { score: { type: "number", maximum: 99 } },
			required: ["score"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: { score: { type: "number", exclusiveMaximum: 100 } },
			required: ["score"],
		};
		expect(checker.isSubset(sub, sup)).toBe(true);
	});

	test("nested: maximum: 100 ⊄ exclusiveMaximum: 100 — (-∞, 100] ⊄ (-∞, 100)", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: { score: { type: "number", maximum: 100 } },
			required: ["score"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: { score: { type: "number", exclusiveMaximum: 100 } },
			required: ["score"],
		};
		expect(checker.isSubset(sub, sup)).toBe(false);
	});

	// ── Deeply nested (3 levels) ────────────────────────────────────────

	test("deeply nested: a.b.value.exclusiveMinimum: 10 ⊆ a.b.value.minimum: 10", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				a: {
					type: "object",
					properties: {
						b: {
							type: "object",
							properties: {
								value: { type: "number", exclusiveMinimum: 10 },
							},
							required: ["value"],
						},
					},
					required: ["b"],
				},
			},
			required: ["a"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				a: {
					type: "object",
					properties: {
						b: {
							type: "object",
							properties: {
								value: { type: "number", minimum: 10 },
							},
							required: ["value"],
						},
					},
					required: ["b"],
				},
			},
			required: ["a"],
		};
		expect(checker.isSubset(sub, sup)).toBe(true);
	});

	test("deeply nested: a.b.value.exclusiveMaximum: 50 ⊆ a.b.value.maximum: 50", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				a: {
					type: "object",
					properties: {
						b: {
							type: "object",
							properties: {
								value: { type: "number", exclusiveMaximum: 50 },
							},
							required: ["value"],
						},
					},
					required: ["b"],
				},
			},
			required: ["a"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				a: {
					type: "object",
					properties: {
						b: {
							type: "object",
							properties: {
								value: { type: "number", maximum: 50 },
							},
							required: ["value"],
						},
					},
					required: ["b"],
				},
			},
			required: ["a"],
		};
		expect(checker.isSubset(sub, sup)).toBe(true);
	});

	// ── Multiple properties with mixed bounds ───────────────────────────

	test("multiple nested properties with mixed exclusive/inclusive bounds", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				minScore: { type: "number", exclusiveMinimum: 0 },
				maxScore: { type: "number", exclusiveMaximum: 100 },
				level: { type: "integer", minimum: 2 },
			},
			required: ["minScore", "maxScore", "level"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				minScore: { type: "number", minimum: 0 },
				maxScore: { type: "number", maximum: 100 },
				level: { type: "integer", exclusiveMinimum: 1 },
			},
			required: ["minScore", "maxScore", "level"],
		};
		expect(checker.isSubset(sub, sup)).toBe(true);
	});

	// ── Top-level still works (regression guard) ────────────────────────

	test("top-level: exclusiveMinimum: 5 ⊆ minimum: 5 (still works)", () => {
		const sub: JSONSchema7 = { type: "number", exclusiveMinimum: 5 };
		const sup: JSONSchema7 = { type: "number", minimum: 5 };
		expect(checker.isSubset(sub, sup)).toBe(true);
	});

	test("top-level: exclusiveMaximum: 100 ⊆ maximum: 100 (still works)", () => {
		const sub: JSONSchema7 = { type: "number", exclusiveMaximum: 100 };
		const sup: JSONSchema7 = { type: "number", maximum: 100 };
		expect(checker.isSubset(sub, sup)).toBe(true);
	});

	// ── check() async path (same logic, runtime facade) ─────────────────

	test("check(): nested exclusiveMinimum: 5 ⊆ minimum: 5", async () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: { score: { type: "number", exclusiveMinimum: 5 } },
			required: ["score"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: { score: { type: "number", minimum: 5 } },
			required: ["score"],
		};
		const result = await checker.check(sub, sup);
		expect(result.isSubset).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	test("check(): nested minimum: 5 ⊄ exclusiveMinimum: 5", async () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: { score: { type: "number", minimum: 5 } },
			required: ["score"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: { score: { type: "number", exclusiveMinimum: 5 } },
			required: ["score"],
		};
		const result = await checker.check(sub, sup);
		expect(result.isSubset).toBe(false);
	});

	// ── Property exists only in sup (no sub counterpart) ────────────────

	test("nested: sup has property with bounds but sub does not — no crash", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: { name: { type: "string" } },
			required: ["name"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				name: { type: "string" },
				score: { type: "number", minimum: 5 },
			},
			required: ["name"],
		};
		// sub doesn't have score property — the merge adds it from sup,
		// making merged ≠ sub → isSubset returns false. The important thing
		// here is that the recursion in stripRedundantBoundsFromSup does NOT
		// crash when sub lacks a property that sup defines.
		expect(() => checker.isSubset(sub, sup)).not.toThrow();
	});
});
