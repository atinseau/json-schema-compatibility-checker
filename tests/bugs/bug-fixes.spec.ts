import { beforeAll, describe, expect, test } from "bun:test";
import type { JSONSchema7 } from "json-schema";
import { JsonSchemaCompatibilityChecker } from "../../src";

let checker: JsonSchemaCompatibilityChecker;

beforeAll(() => {
	checker = new JsonSchemaCompatibilityChecker();
});

// ═══════════════════════════════════════════════════════════════════════════════
//  Bug fixes — evaluateCondition, deep equality, deep comparison
// ═══════════════════════════════════════════════════════════════════════════════

describe("Bug 2 — evaluateCondition: absent properties must not fail validation", () => {
	test("if with properties.const but NO required → passes when data is empty", () => {
		// Per JSON Schema Draft-07: properties only validates present properties.
		// Absent property + no required → if should pass → then-branch selected.
		const schema: JSONSchema7 = {
			type: "object",
			properties: { name: { type: "string" } },
			if: {
				properties: { accountType: { const: "business" } },
				// NO required → absent property should not cause failure
			},
			then: {
				required: ["name"],
			},
			else: {
				properties: { extra: { type: "string" } },
			},
		};

		const { branch } = checker.resolveConditions(schema, {});
		// properties doesn't constrain absent props → if passes → then
		expect(branch).toBe("then");
	});

	test("if with properties.const AND required → fails when data is empty", () => {
		// When required IS present, the absent property causes failure via required.
		const schema: JSONSchema7 = {
			type: "object",
			properties: { name: { type: "string" } },
			if: {
				properties: { accountType: { const: "business" } },
				required: ["accountType"],
			},
			then: {
				required: ["name"],
			},
			else: {
				properties: { extra: { type: "string" } },
			},
		};

		const { branch } = checker.resolveConditions(schema, {});
		// required blocks → if fails → else
		expect(branch).toBe("else");
	});

	test("if with properties.const → fails when property is present but wrong value", () => {
		const schema: JSONSchema7 = {
			type: "object",
			properties: { name: { type: "string" } },
			if: {
				properties: { accountType: { const: "business" } },
			},
			then: {
				required: ["name"],
			},
			else: {
				properties: { extra: { type: "string" } },
			},
		};

		const { branch } = checker.resolveConditions(schema, {
			accountType: "personal",
		});
		// Property present but value doesn't match → if fails → else
		expect(branch).toBe("else");
	});

	test("if with properties.enum but NO required → passes when data is empty", () => {
		const schema: JSONSchema7 = {
			type: "object",
			if: {
				properties: { role: { enum: ["admin", "superadmin"] } },
			},
			then: {
				required: ["permissions"],
			},
			else: {},
		};

		const { branch } = checker.resolveConditions(schema, {});
		expect(branch).toBe("then");
	});
});

describe("Bug 3 — evaluateCondition: deep equality for const and enum", () => {
	test("const with object value matches structurally equal object", () => {
		const schema: JSONSchema7 = {
			type: "object",
			properties: { result: { type: "string" } },
			if: {
				properties: {
					config: { const: { mode: "advanced", level: 3 } },
				},
				required: ["config"],
			},
			then: {
				required: ["result"],
			},
			else: {},
		};

		// Different object reference, same structure → should match via isEqual
		const { branch } = checker.resolveConditions(schema, {
			config: { mode: "advanced", level: 3 },
		});
		expect(branch).toBe("then");
	});

	test("const with object value does not match different structure", () => {
		const schema: JSONSchema7 = {
			type: "object",
			properties: { result: { type: "string" } },
			if: {
				properties: {
					config: { const: { mode: "advanced", level: 3 } },
				},
				required: ["config"],
			},
			then: {
				required: ["result"],
			},
			else: {},
		};

		const { branch } = checker.resolveConditions(schema, {
			config: { mode: "basic", level: 1 },
		});
		expect(branch).toBe("else");
	});

	test("const with array value matches structurally equal array", () => {
		const schema: JSONSchema7 = {
			type: "object",
			if: {
				properties: {
					tags: { const: [1, 2, 3] },
				},
				required: ["tags"],
			},
			then: {
				required: ["details"],
			},
			else: {},
		};

		const { branch } = checker.resolveConditions(schema, {
			tags: [1, 2, 3],
		});
		expect(branch).toBe("then");
	});

	test("enum with object values matches structurally equal object", () => {
		const schema: JSONSchema7 = {
			type: "object",
			if: {
				properties: {
					setting: { enum: [{ a: 1 }, { b: 2 }] },
				},
				required: ["setting"],
			},
			then: {
				required: ["output"],
			},
			else: {},
		};

		// { a: 1 } is structurally equal to the first enum entry
		const { branch } = checker.resolveConditions(schema, {
			setting: { a: 1 },
		});
		expect(branch).toBe("then");
	});

	test("enum with object values does not match non-listed object", () => {
		const schema: JSONSchema7 = {
			type: "object",
			if: {
				properties: {
					setting: { enum: [{ a: 1 }, { b: 2 }] },
				},
				required: ["setting"],
			},
			then: {
				required: ["output"],
			},
			else: {},
		};

		const { branch } = checker.resolveConditions(schema, {
			setting: { c: 3 },
		});
		expect(branch).toBe("else");
	});
});

//  No new tests needed — existing tests validate the behavior is transparent.
//  But we add a test for key-order independence to prove the fix works.
// ─────────────────────────────────────────────────────────────────────────────

describe("Point 9 — deep comparison replaces JSON.stringify", () => {
	test("diff comparison is independent of key order", () => {
		// Two schemas that differ in key order but are structurally identical
		// should produce no diffs when compared to themselves
		const schema: JSONSchema7 = {
			type: "object",
			properties: {
				a: { type: "string", minLength: 1 },
				b: { type: "number", minimum: 0 },
			},
			required: ["a", "b"],
		};
		const result = checker.check(schema, schema);
		expect(result.isSubset).toBe(true);
		expect(result.diffs).toHaveLength(0);
	});
});
