import { beforeAll, describe, expect, test } from "bun:test";
import type { JSONSchema7, JSONSchema7Definition } from "json-schema";
import { JsonSchemaCompatibilityChecker } from "../../src";

let checker: JsonSchemaCompatibilityChecker;

beforeAll(() => {
	checker = new JsonSchemaCompatibilityChecker();
});

// ═══════════════════════════════════════════════════════════════════════════════
//  $ref — CRITICAL GAP
//  $ref is the most used composition mechanism in JSON Schema.
//  The checker has NO $ref resolution. These tests document what happens.
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
//  1. $ref — CRITICAL GAP
//
//  $ref is the most used composition mechanism in JSON Schema.
//  The checker has NO $ref resolution. These tests document what happens
//  when $ref is encountered — spoiler: it's silently ignored.
// ─────────────────────────────────────────────────────────────────────────────

describe("$ref — CRITICAL GAP", () => {
	test("$ref to definitions is silently ignored — schema with $ref treated as empty", () => {
		const schema: JSONSchema7 = {
			type: "object",
			definitions: {
				address: {
					type: "object",
					properties: { street: { type: "string" } },
					required: ["street"],
				},
			},
			properties: {
				billing: { $ref: "#/definitions/address" },
			},
			required: ["billing"],
		};

		// The $ref is not resolved, so "billing" has no constraints
		// normalized billing property should be { $ref: "..." } which is opaque
		const normalized = checker.normalize(schema) as JSONSchema7;
		const billingProp = (
			normalized.properties as Record<string, JSONSchema7Definition> | undefined
		)?.billing;

		// $ref is kept as-is (not resolved, not removed)
		expect(billingProp).toHaveProperty("$ref");
	});

	test("subset check with $ref produces INCORRECT result — $ref is invisible", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				name: { type: "string" },
			},
		};

		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				name: { $ref: "#/definitions/strictName" },
			},
			definitions: {
				strictName: {
					type: "string",
					minLength: 5,
					maxLength: 100,
				},
			},
		};

		// This SHOULD be true (sub.name is string, sup.name via $ref is string+constraints)
		// But since $ref is not resolved, sup.name has no type constraint visible
		// The merge treats $ref as an opaque key
		const result = checker.isSubset(sub, sup);

		// Document the actual behavior: $ref is not resolved so the check
		// doesn't see the constraints from the referenced schema
		// The result may be true because sup.name effectively has no visible constraints
		expect(typeof result).toBe("boolean");
		// This is the key insight: the result is UNRELIABLE when $ref is present
	});

	test("intersect with $ref — $ref key is preserved but NOT dereferenced", () => {
		const a: JSONSchema7 = {
			type: "object",
			properties: {
				x: { type: "string", minLength: 1 },
			},
		};

		const b: JSONSchema7 = {
			type: "object",
			properties: {
				x: { $ref: "#/definitions/foo" },
			},
			definitions: {
				foo: { type: "string", maxLength: 50 },
			},
		};

		const result = checker.intersect(a, b);
		// The merge should succeed (no type conflict visible since $ref is opaque)
		// but the result won't contain the maxLength from the $ref target
		expect(result).not.toBeNull();
		if (result && typeof result !== "boolean") {
			const xProp = (result as JSONSchema7).properties?.x;
			if (xProp && typeof xProp !== "boolean") {
				// maxLength from definitions.foo is NOT applied (not dereferenced)
				expect(xProp).not.toHaveProperty("maxLength");
			}
		}
	});

	test("$ref across both schemas — check produces meaningless result", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				data: { $ref: "#/definitions/payload" },
			},
			definitions: {
				payload: { type: "string" },
			},
		};

		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				data: { $ref: "#/definitions/payload" },
			},
			definitions: {
				payload: { type: "number" },
			},
		};

		// These schemas have INCOMPATIBLE types (string vs number) via $ref
		// But since $ref is not resolved, the checker sees both as opaque
		const result = checker.isSubset(sub, sup);
		// The checker cannot detect the incompatibility
		expect(typeof result).toBe("boolean");
	});

	test("canConnect with $ref — connection check is unreliable", () => {
		const sourceOutput: JSONSchema7 = {
			type: "object",
			properties: {
				result: { $ref: "#/definitions/output" },
			},
			definitions: {
				output: {
					type: "object",
					properties: { value: { type: "number" } },
					required: ["value"],
				},
			},
		};

		const targetInput: JSONSchema7 = {
			type: "object",
			properties: {
				result: {
					type: "object",
					properties: { value: { type: "number" } },
					required: ["value"],
				},
			},
			required: ["result"],
		};

		const result = checker.canConnect(sourceOutput, targetInput);
		// Source has $ref (unresolved), target has inline schema
		// The result is unreliable
		expect(result).toHaveProperty("isSubset");
		expect(result).toHaveProperty("direction");
	});
});
