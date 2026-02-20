import { beforeAll, describe, expect, test } from "bun:test";
import type { JSONSchema7 } from "json-schema";
import { JsonSchemaCompatibilityChecker } from "../../src";

let checker: JsonSchemaCompatibilityChecker;

beforeAll(() => {
	checker = new JsonSchemaCompatibilityChecker();
});

// ═══════════════════════════════════════════════════════════════════════════════
//  oneOf vs anyOf — distinction, exclusivity semantics, diff paths
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
//  Point 6 — oneOf vs anyOf distinction
// ─────────────────────────────────────────────────────────────────────────────

describe("Point 6 — oneOf vs anyOf distinction", () => {
	test("anyOf subset ⊆ anyOf superset uses anyOf[i] in diff path", () => {
		const sub: JSONSchema7 = {
			anyOf: [{ type: "string" }, { type: "number" }, { type: "boolean" }],
		};
		const sup: JSONSchema7 = {
			anyOf: [{ type: "string" }, { type: "number" }],
		};
		const result = checker.check(sub, sup);
		expect(result.isSubset).toBe(false);
		const diff = result.diffs.find((d) => d.path.startsWith("anyOf["));
		expect(diff).toBeDefined();
		expect(diff?.path).toMatch(/^anyOf\[\d+\]$/);
	});

	test("oneOf subset uses oneOf[i] in diff path", () => {
		const sub: JSONSchema7 = {
			oneOf: [{ type: "string" }, { type: "number" }, { type: "boolean" }],
		};
		const sup: JSONSchema7 = {
			oneOf: [{ type: "string" }, { type: "number" }],
		};
		const result = checker.check(sub, sup);
		expect(result.isSubset).toBe(false);
		const diff = result.diffs.find((d) => d.path.startsWith("oneOf["));
		expect(diff).toBeDefined();
		expect(diff?.path).toMatch(/^oneOf\[\d+\]$/);
	});

	test("{ anyOf: [{ type: 'string' }] } ⊆ { oneOf: [{ type: 'string' }, { type: 'number' }] }", () => {
		expect(
			checker.isSubset(
				{ anyOf: [{ type: "string" }] },
				{ oneOf: [{ type: "string" }, { type: "number" }] },
			),
		).toBe(true);
	});

	test("{ oneOf: [{ type: 'string' }, { type: 'number' }] } ⊄ { anyOf: [{ type: 'string' }] }", () => {
		expect(
			checker.isSubset(
				{ oneOf: [{ type: "string" }, { type: "number" }] },
				{ anyOf: [{ type: "string" }] },
			),
		).toBe(false);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
//  3. oneOf exclusivity semantics
//
//  Draft 7: oneOf means EXACTLY one branch matches.
//  The checker treats oneOf identically to anyOf (AT LEAST one matches).
// ─────────────────────────────────────────────────────────────────────────────

describe("oneOf — exclusivity semantics (NOT enforced)", () => {
	test("oneOf treated as anyOf for subset check — no exclusivity verification", () => {
		// In strict oneOf semantics, if a value matches MULTIPLE branches,
		// it should be REJECTED. The checker doesn't verify this.
		const sub: JSONSchema7 = {
			oneOf: [
				{ type: "string", minLength: 1 },
				{ type: "string", maxLength: 100 },
			],
		};

		// These branches OVERLAP (any string 1-100 chars matches both)
		// In strict oneOf, values matching both branches would be rejected
		// The checker doesn't detect this overlap
		const sup: JSONSchema7 = { type: "string" };

		const result = checker.isSubset(sub, sup);
		// The checker treats it as anyOf: each branch is ⊆ string → true
		// In strict oneOf, overlapping branches make the accepted set smaller
		expect(result).toBe(true); // Correct for anyOf semantics, potentially wrong for strict oneOf
	});

	test("oneOf with disjoint branches — correct regardless of semantics", () => {
		const sub: JSONSchema7 = {
			oneOf: [{ type: "string" }, { type: "number" }],
		};

		const sup: JSONSchema7 = {
			anyOf: [{ type: "string" }, { type: "number" }, { type: "boolean" }],
		};

		// Disjoint branches: anyOf and oneOf are equivalent
		expect(checker.isSubset(sub, sup)).toBe(true);
	});

	test("oneOf with overlapping const branches — overlap not detected", () => {
		// This is actually fine because const values can't overlap
		const sub: JSONSchema7 = {
			oneOf: [
				{
					type: "object",
					properties: { kind: { const: "a" } },
					required: ["kind"],
				},
				{
					type: "object",
					properties: { kind: { const: "b" } },
					required: ["kind"],
				},
			],
		};

		const sup: JSONSchema7 = {
			type: "object",
			properties: { kind: { type: "string" } },
			required: ["kind"],
		};

		// Discriminated union — oneOf with const discriminant is always safe
		expect(checker.isSubset(sub, sup)).toBe(true);
	});

	test("oneOf in sup — at least one branch must accept sub (same as anyOf)", () => {
		const sub: JSONSchema7 = { type: "string", minLength: 5 };

		const sup: JSONSchema7 = {
			oneOf: [{ type: "string" }, { type: "number" }],
		};

		// sub matches the first branch
		expect(checker.isSubset(sub, sup)).toBe(true);
	});

	test("check() uses oneOf label in diff paths (not anyOf)", () => {
		const sub: JSONSchema7 = {
			oneOf: [
				{ type: "string" },
				{ type: "number" },
				{ type: "boolean" }, // extra branch not in sup
			],
		};

		const sup: JSONSchema7 = {
			oneOf: [{ type: "string" }, { type: "number" }],
		};

		const result = checker.check(sub, sup);
		expect(result.isSubset).toBe(false);
		// The diff path should mention "oneOf", not "anyOf"
		const hasOneOfPath = result.diffs.some((d) => d.path.startsWith("oneOf"));
		expect(hasOneOfPath).toBe(true);
	});
});
