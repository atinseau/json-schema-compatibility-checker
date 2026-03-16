import { beforeAll, describe, expect, test } from "bun:test";
import type { JSONSchema7 } from "json-schema";
import { JsonSchemaCompatibilityChecker } from "../../src";

let checker: JsonSchemaCompatibilityChecker;

beforeAll(() => {
	checker = new JsonSchemaCompatibilityChecker();
});

// ═══════════════════════════════════════════════════════════════════════════════
//  Bug 1 — `not`: check() ignores evaluateNot()
//
//  isSubset() correctly evaluates the `not` keyword via evaluateNot(), but
//  check() (via checkAtomic) did not call evaluateNot() / stripNotFromSup(),
//  and computeSemanticErrors() used a naive deepEqual instead of semantic logic.
//  This produced false-positive `not_schema` errors when check() should have
//  returned isSubset: true with no errors.
// ═══════════════════════════════════════════════════════════════════════════════

describe("Bug 1 — check() not keyword", () => {
	// ── Simple type disjointness: string vs not(number) ──
	test("check() ⊆ true when sub.type !== sup.not.type", () => {
		const result = checker.check(
			{ type: "string" },
			{ not: { type: "number" } },
		);
		expect(result.isSubset).toBe(true);
		expect(result.errors).toEqual([]);
	});

	// ── Identical type → should fail ──
	test("check() ⊆ false when sub.type === sup.not.type", () => {
		const result = checker.check(
			{ type: "string" },
			{ not: { type: "string" } },
		);
		expect(result.isSubset).toBe(false);
		expect(result.errors).toContainEqual(
			expect.objectContaining({ type: "not_schema" }),
		);
	});

	// ── Disjoint enum vs not.enum ──
	test("check() ⊆ true when sub.enum is disjoint from sup.not.enum", () => {
		const result = checker.check(
			{ type: "string", enum: ["active", "pending"] },
			{ type: "string", not: { enum: ["deleted", "archived"] } },
		);
		expect(result.isSubset).toBe(true);
		expect(result.errors).toEqual([]);
	});

	// ── Nested property: sub enum vs sup not.const ──
	test("check() ⊆ true for nested property not constraint", () => {
		const result = checker.check(
			{
				type: "object",
				properties: { status: { type: "string", enum: ["active"] } },
				required: ["status"],
			},
			{
				type: "object",
				properties: {
					status: { type: "string", not: { const: "banned" } },
				},
				required: ["status"],
			},
		);
		expect(result.isSubset).toBe(true);
		expect(result.errors).toEqual([]);
	});

	// ── Object with property type vs not type ──
	test("check() ⊆ true when object property type differs from not type", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: { value: { type: "string" } },
			required: ["value"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: { value: { not: { type: "number" } } },
			required: ["value"],
		};
		// Verify isSubset agrees
		expect(checker.isSubset(sub, sup)).toBe(true);

		const result = checker.check(sub, sup);
		expect(result.isSubset).toBe(true);
		expect(result.errors).toEqual([]);
	});

	// ── number vs not(string) ──
	test("check() ⊆ true for number ⊆ not(string)", () => {
		const result = checker.check(
			{ type: "number", minimum: 5 },
			{ not: { type: "string" } },
		);
		expect(result.isSubset).toBe(true);
		expect(result.errors).toEqual([]);
	});

	// ── const vs not(different const) ──
	test("check() ⊆ true for const ⊆ not(different const)", () => {
		const sub: JSONSchema7 = { type: "string", const: "hello" };
		const sup: JSONSchema7 = { not: { const: "world" } };
		expect(checker.isSubset(sub, sup)).toBe(true);

		const result = checker.check(sub, sup);
		expect(result.isSubset).toBe(true);
		expect(result.errors).toEqual([]);
	});

	// ── Coherence: check() and isSubset() must always agree ──
	test("check() and isSubset() should agree on not keyword", () => {
		const schemas: [JSONSchema7, JSONSchema7][] = [
			[{ type: "string" }, { not: { type: "number" } }],
			[{ type: "string", const: "hello" }, { not: { const: "world" } }],
			[{ type: "number", minimum: 5 }, { not: { type: "string" } }],
			[{ type: "string" }, { not: { type: "string" } }],
		];

		for (const [sub, sup] of schemas) {
			const subsetResult = checker.isSubset(sub, sup);
			const checkResult = checker.check(sub, sup);
			expect(checkResult.isSubset).toBe(subsetResult);
		}
	});

	// ── Semantic errors: not_schema error suppressed when not is satisfied ──
	test("check() should NOT report not_schema error when type disjointness confirms compatibility", () => {
		const result = checker.check(
			{ type: "string" },
			{ not: { type: "number" } },
		);
		const notErrors = result.errors.filter((e) => e.type === "not_schema");
		expect(notErrors).toEqual([]);
	});

	// ── Semantic errors: not_schema error present when not is violated ──
	test("check() should report not_schema error when not is violated", () => {
		const result = checker.check(
			{ type: "string" },
			{ not: { type: "string" } },
		);
		const notErrors = result.errors.filter((e) => e.type === "not_schema");
		expect(notErrors.length).toBeGreaterThan(0);
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
//  Bug 2 — `dependencies`: no semantic deduction via `required`
//
//  When sup declares array-form dependencies (e.g. { name: ['email'] }),
//  computeSemanticErrors reported an error even if the dependency was trivially
//  satisfied by sub.required or vacuously true because the trigger is absent.
//
//  NOTE: The structural merge also keeps dependencies in the merged result,
//  so isSubset() itself returns false for these cases (known limitation).
//  The fix here ensures that computeSemanticErrors does not produce SPURIOUS
//  dependency errors — but isSubset may still be false due to the merge engine.
//  We test that check() and isSubset() agree, and that the semantic errors
//  are correct (no spurious object_constraint errors).
// ═══════════════════════════════════════════════════════════════════════════════

describe("Bug 2 — check() dependencies with required", () => {
	// ── When sub already has the same dependencies → should pass ──
	test("should pass when sub has the same dependencies as sup", () => {
		const result = checker.check(
			{
				type: "object",
				properties: {
					name: { type: "string" },
					email: { type: "string" },
				},
				required: ["name", "email"],
				dependencies: { name: ["email"] },
			} as JSONSchema7,
			{
				type: "object",
				properties: {
					name: { type: "string" },
					email: { type: "string" },
				},
				required: ["name", "email"],
				dependencies: { name: ["email"] },
			} as JSONSchema7,
		);
		expect(result.isSubset).toBe(true);
		expect(result.errors).toEqual([]);
	});

	// ── Trigger present but dependent not required → should fail ──
	test("should fail when trigger is present but dependent is not required", () => {
		const result = checker.check(
			{
				type: "object",
				properties: {
					name: { type: "string" },
					email: { type: "string" },
				},
				required: ["name"], // email is NOT required
			},
			{
				type: "object",
				properties: {
					name: { type: "string" },
					email: { type: "string" },
				},
				required: ["name"],
				dependencies: { name: ["email"] },
			} as JSONSchema7,
		);
		expect(result.isSubset).toBe(false);
		expect(result.errors).toContainEqual(
			expect.objectContaining({ type: "object_constraint" }),
		);
	});

	// ── Semantic deduction: dependencies satisfied by required ──
	// The fix ensures computeSemanticErrors does NOT report a spurious
	// object_constraint error when all dependent props are in sub.required.
	// However, the merge engine still adds the dependency keyword to the
	// merged result, so isSubset returns false (structural limitation).
	// What we test: check() and isSubset() agree, and no spurious dependency error.
	test("no spurious dependency error when all deps are in sub.required", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				name: { type: "string" },
				email: { type: "string" },
			},
			required: ["name", "email"],
		};
		const sup = {
			type: "object",
			properties: {
				name: { type: "string" },
				email: { type: "string" },
			},
			required: ["name", "email"],
			dependencies: { name: ["email"] },
		} as JSONSchema7;

		const checkResult = checker.check(sub, sup);
		const isSubsetResult = checker.isSubset(sub, sup);
		// check() and isSubset() must agree
		expect(checkResult.isSubset).toBe(isSubsetResult);

		// If isSubset is false (structural limitation), verify no spurious
		// dependency error in the semantic errors
		if (!checkResult.isSubset) {
			const depErrors = checkResult.errors.filter(
				(e) =>
					e.type === "object_constraint" && e.expected.includes("dependency"),
			);
			expect(depErrors).toEqual([]);
		}
	});

	// ── Semantic deduction: trigger never produced ──
	test("no spurious dependency error when trigger property is absent from sub", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: { name: { type: "string" } },
			required: ["name"],
			additionalProperties: false,
		};
		const sup = {
			type: "object",
			properties: {
				name: { type: "string" },
				nickname: { type: "string" },
				avatar: { type: "string" },
			},
			required: ["name"],
			dependencies: { nickname: ["avatar"] },
		} as JSONSchema7;

		const checkResult = checker.check(sub, sup);
		const isSubsetResult = checker.isSubset(sub, sup);
		expect(checkResult.isSubset).toBe(isSubsetResult);

		// No spurious dependency error
		if (!checkResult.isSubset) {
			const depErrors = checkResult.errors.filter(
				(e) =>
					e.type === "object_constraint" && e.expected.includes("dependency"),
			);
			expect(depErrors).toEqual([]);
		}
	});

	// ── Schema-form dependency with absent trigger ──
	test("no spurious schema-form dependency error when trigger is absent", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: { name: { type: "string" } },
			required: ["name"],
			additionalProperties: false,
		};
		const sup = {
			type: "object",
			properties: {
				name: { type: "string" },
				nickname: { type: "string" },
			},
			required: ["name"],
			dependencies: {
				nickname: { properties: { avatar: { type: "string" } } },
			},
		} as JSONSchema7;

		const checkResult = checker.check(sub, sup);
		const isSubsetResult = checker.isSubset(sub, sup);
		expect(checkResult.isSubset).toBe(isSubsetResult);

		// No spurious dependency error
		if (!checkResult.isSubset) {
			const depErrors = checkResult.errors.filter(
				(e) =>
					e.type === "object_constraint" && e.expected.includes("dependency"),
			);
			expect(depErrors).toEqual([]);
		}
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
//  Bug 3 — No cross-check minimum ↔ exclusiveMinimum / maximum ↔ exclusiveMaximum
//
//  checkNumericConstraints() checked each bound independently without
//  cross-validation. In JSON Schema draft-07, exclusiveMinimum: 5 means
//  value > 5, which is strictly more restrictive than minimum: 5 (value >= 5).
//
//  NOTE: The merge engine also produces cross-bound results (e.g. both minimum
//  and exclusiveMinimum in merged), so isSubset() itself returns false for these
//  cases (known structural limitation per AGENTS.md). The fix here ensures that
//  computeSemanticErrors does not produce SPURIOUS numeric_constraint errors.
// ═══════════════════════════════════════════════════════════════════════════════

describe("Bug 3 — check() mixed exclusive/inclusive bounds", () => {
	// ── Cross-check: no spurious numeric_constraint errors ──
	test("no spurious minimum error when sub has exclusiveMinimum >= sup.minimum", () => {
		const sub: JSONSchema7 = { type: "number", exclusiveMinimum: 5 };
		const sup: JSONSchema7 = { type: "number", minimum: 5 };

		const checkResult = checker.check(sub, sup);
		const isSubsetResult = checker.isSubset(sub, sup);
		expect(checkResult.isSubset).toBe(isSubsetResult);

		// Even if isSubset is false (structural limitation), there should be
		// no spurious "minimum: 5" error since exclusiveMinimum: 5 satisfies it
		const minErrors = checkResult.errors.filter(
			(e) => e.type === "numeric_constraint" && e.expected.includes("minimum"),
		);
		expect(minErrors).toEqual([]);
	});

	test("no spurious exclusiveMinimum error when sub.minimum > sup.exclusiveMinimum", () => {
		const sub: JSONSchema7 = { type: "number", minimum: 6 };
		const sup: JSONSchema7 = { type: "number", exclusiveMinimum: 5 };

		const checkResult = checker.check(sub, sup);
		const isSubsetResult = checker.isSubset(sub, sup);
		expect(checkResult.isSubset).toBe(isSubsetResult);

		const exclMinErrors = checkResult.errors.filter(
			(e) =>
				e.type === "numeric_constraint" &&
				e.expected.includes("exclusiveMinimum"),
		);
		expect(exclMinErrors).toEqual([]);
	});

	test("no spurious maximum error when sub has exclusiveMaximum <= sup.maximum", () => {
		const sub: JSONSchema7 = { type: "number", exclusiveMaximum: 100 };
		const sup: JSONSchema7 = { type: "number", maximum: 100 };

		const checkResult = checker.check(sub, sup);
		const isSubsetResult = checker.isSubset(sub, sup);
		expect(checkResult.isSubset).toBe(isSubsetResult);

		const maxErrors = checkResult.errors.filter(
			(e) => e.type === "numeric_constraint" && e.expected.includes("maximum"),
		);
		expect(maxErrors).toEqual([]);
	});

	test("no spurious exclusiveMaximum error when sub.maximum < sup.exclusiveMaximum", () => {
		const sub: JSONSchema7 = { type: "number", maximum: 99 };
		const sup: JSONSchema7 = { type: "number", exclusiveMaximum: 100 };

		const checkResult = checker.check(sub, sup);
		const isSubsetResult = checker.isSubset(sub, sup);
		expect(checkResult.isSubset).toBe(isSubsetResult);

		const exclMaxErrors = checkResult.errors.filter(
			(e) =>
				e.type === "numeric_constraint" &&
				e.expected.includes("exclusiveMaximum"),
		);
		expect(exclMaxErrors).toEqual([]);
	});

	// ── Correctly reports error when bounds are not satisfied ──
	test("sub.minimum: 5 should NOT satisfy sup.exclusiveMinimum: 5 (edge case)", () => {
		const result = checker.check(
			{ type: "number", minimum: 5 },
			{ type: "number", exclusiveMinimum: 5 },
		);
		expect(result.isSubset).toBe(false);
		expect(result.errors).toContainEqual(
			expect.objectContaining({ type: "numeric_constraint" }),
		);
	});

	test("sub.maximum: 100 should NOT satisfy sup.exclusiveMaximum: 100 (edge case)", () => {
		const result = checker.check(
			{ type: "number", maximum: 100 },
			{ type: "number", exclusiveMaximum: 100 },
		);
		expect(result.isSubset).toBe(false);
		expect(result.errors).toContainEqual(
			expect.objectContaining({ type: "numeric_constraint" }),
		);
	});

	// ── Same-kind bounds still work (no regression) ──
	test("sub.minimum: 10 ⊆ sup.minimum: 5 (same kind, no cross needed)", () => {
		const result = checker.check(
			{ type: "number", minimum: 10 },
			{ type: "number", minimum: 5 },
		);
		expect(result.isSubset).toBe(true);
		expect(result.errors).toEqual([]);
	});

	test("sub.minimum: 3 ⊄ sup.minimum: 5 (same kind, regression check)", () => {
		const result = checker.check(
			{ type: "number", minimum: 3 },
			{ type: "number", minimum: 5 },
		);
		expect(result.isSubset).toBe(false);
		expect(result.errors).toContainEqual(
			expect.objectContaining({ type: "numeric_constraint" }),
		);
	});

	test("sub.maximum: 50 ⊆ sup.maximum: 100 (same kind, no cross needed)", () => {
		const result = checker.check(
			{ type: "number", maximum: 50 },
			{ type: "number", maximum: 100 },
		);
		expect(result.isSubset).toBe(true);
		expect(result.errors).toEqual([]);
	});

	test("sub.maximum: 150 ⊄ sup.maximum: 100 (same kind, regression check)", () => {
		const result = checker.check(
			{ type: "number", maximum: 150 },
			{ type: "number", maximum: 100 },
		);
		expect(result.isSubset).toBe(false);
		expect(result.errors).toContainEqual(
			expect.objectContaining({ type: "numeric_constraint" }),
		);
	});

	// ── Coherence: check() and isSubset() must always agree ──
	test("check() and isSubset() agree on mixed bounds", () => {
		const schemas: [JSONSchema7, JSONSchema7][] = [
			[
				{ type: "number", exclusiveMinimum: 5 },
				{ type: "number", minimum: 5 },
			],
			[
				{ type: "number", minimum: 6 },
				{ type: "number", exclusiveMinimum: 5 },
			],
			[
				{ type: "number", exclusiveMaximum: 100 },
				{ type: "number", maximum: 100 },
			],
			[
				{ type: "number", maximum: 99 },
				{ type: "number", exclusiveMaximum: 100 },
			],
			[
				{ type: "number", minimum: 5 },
				{ type: "number", exclusiveMinimum: 5 },
			],
			[
				{ type: "number", maximum: 100 },
				{ type: "number", exclusiveMaximum: 100 },
			],
		];

		for (const [sub, sup] of schemas) {
			const subsetResult = checker.isSubset(sub, sup);
			const checkResult = checker.check(sub, sup);
			expect(checkResult.isSubset).toBe(subsetResult);
		}
	});
});
