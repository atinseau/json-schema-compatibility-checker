import { beforeAll, describe, expect, test } from "bun:test";
import type { JSONSchema7 } from "json-schema";
import { JsonSchemaCompatibilityChecker } from "../../src";

let checker: JsonSchemaCompatibilityChecker;

beforeAll(() => {
	checker = new JsonSchemaCompatibilityChecker();
});

// ═══════════════════════════════════════════════════════════════════════════════
//  if/then/else — structural limitations, mergeBranchInto fix, and audit
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
//  if / then / else — Known limitations of structural approach
// ─────────────────────────────────────────────────────────────────────────────

describe("if/then/else — structural limitations", () => {
	const conditionalSchema: JSONSchema7 = {
		type: "object",
		properties: {
			kind: { type: "string" },
			value: {},
		},
		required: ["kind", "value"],
		if: {
			properties: { kind: { const: "text" } },
			required: ["kind"],
		},
		then: {
			properties: { value: { type: "string" } },
		},
		else: {
			properties: { value: { type: "number" } },
		},
	};

	test("identity A ⊆ A with if/then/else (fixed by identity short-circuit)", () => {
		// Previously failed because merge pushes conditions into allOf,
		// making merged ≠ original. Now fixed: identity short-circuit
		// detects that sub === sup (same reference) and returns true directly.
		expect(checker.isSubset(conditionalSchema, conditionalSchema)).toBe(true);
	});

	test("sub WITH if/then/else ⊆ sup WITHOUT condition works (conditions are extra constraints)", () => {
		const supNoCondition: JSONSchema7 = {
			type: "object",
			properties: {
				kind: { type: "string" },
				value: {},
			},
			required: ["kind", "value"],
		};

		// sub is MORE constrained (has if/then/else), so sub ⊆ sup
		expect(checker.isSubset(conditionalSchema, supNoCondition)).toBe(true);
	});

	test("sub WITHOUT condition ⊄ sup WITH if/then/else (conditions get added to merged)", () => {
		const subNoCondition: JSONSchema7 = {
			type: "object",
			properties: {
				kind: { type: "string" },
				value: {},
			},
			required: ["kind", "value"],
		};

		// The merge adds if/then/else from sup, making merged ≠ sub
		expect(checker.isSubset(subNoCondition, conditionalSchema)).toBe(false);
	});

	test("sub fixing discriminant + matching branch ⊄ sup conditional (false negative)", () => {
		// Semantically sub IS a subset: kind is always "text" and value is always string,
		// which satisfies the then-branch. But structurally the merge adds if/then/else.
		const subFixed: JSONSchema7 = {
			type: "object",
			properties: {
				kind: { const: "text" },
				value: { type: "string" },
			},
			required: ["kind", "value"],
		};

		// This is a known false negative
		expect(checker.isSubset(subFixed, conditionalSchema)).toBe(false);

		const result = checker.check(subFixed, conditionalSchema);
		expect(result.diffs.some((d) => d.path === "if")).toBe(true);
	});

	test("both schemas with same conditions (fixed by identity short-circuit)", () => {
		const result = checker.check(conditionalSchema, conditionalSchema);
		// Previously failed because merge produces allOf residual.
		// Now fixed: identity short-circuit detects same reference → true.
		expect(result.isSubset).toBe(true);
		expect(result.diffs).toHaveLength(0);
	});

	test("both schemas with different conditions produce false", () => {
		const otherConditional: JSONSchema7 = {
			type: "object",
			properties: {
				kind: { type: "string" },
				value: {},
			},
			required: ["kind", "value"],
			if: {
				properties: { kind: { const: "json" } },
				required: ["kind"],
			},
			then: {
				properties: { value: { type: "object" } },
			},
			else: {
				properties: { value: { type: "string" } },
			},
		};

		expect(checker.isSubset(conditionalSchema, otherConditional)).toBe(false);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
//  Point 4 — mergeBranchInto first-writer-wins fix
// ─────────────────────────────────────────────────────────────────────────────

describe("Point 4 — mergeBranchInto fix", () => {
	test("then overrides additionalProperties: true → false", () => {
		const schema: JSONSchema7 = {
			type: "object",
			properties: { mode: { type: "string" } },
			additionalProperties: true,
			if: {
				properties: { mode: { const: "strict" } },
				required: ["mode"],
			},
			then: { additionalProperties: false },
		};
		const { resolved } = checker.resolveConditions(schema, { mode: "strict" });
		expect(resolved.additionalProperties).toBe(false);
	});

	test("then overrides maxLength: 100 → 50", () => {
		const schema: JSONSchema7 = {
			type: "object",
			properties: {
				mode: { type: "string" },
				name: { type: "string", maxLength: 100 },
			},
			required: ["mode"],
			if: {
				properties: { mode: { const: "short" } },
				required: ["mode"],
			},
			then: {
				properties: { name: { type: "string", maxLength: 50 } },
			},
		};
		const { resolved } = checker.resolveConditions(schema, { mode: "short" });
		const nameProp = resolved.properties?.name as JSONSchema7;
		expect(nameProp.maxLength).toBe(50);
	});

	test("then overrides minItems: 1 → 5", () => {
		const schema: JSONSchema7 = {
			type: "object",
			properties: {
				mode: { type: "string" },
				tags: { type: "array", items: { type: "string" }, minItems: 1 },
			},
			required: ["mode"],
			if: {
				properties: { mode: { const: "strict" } },
				required: ["mode"],
			},
			then: {
				properties: {
					tags: { type: "array", items: { type: "string" }, minItems: 5 },
				},
			},
		};
		const { resolved } = checker.resolveConditions(schema, { mode: "strict" });
		const tagsProp = resolved.properties?.tags as JSONSchema7;
		expect(tagsProp.minItems).toBe(5);
	});

	test("then merges items sub-schema (adds minLength)", () => {
		const schema: JSONSchema7 = {
			type: "object",
			properties: {
				mode: { type: "string" },
			},
			items: { type: "string" },
			required: ["mode"],
			if: {
				properties: { mode: { const: "strict" } },
				required: ["mode"],
			},
			then: {
				items: { type: "string", minLength: 3 },
			},
		};
		const { resolved } = checker.resolveConditions(schema, { mode: "strict" });
		const items = resolved.items as JSONSchema7;
		expect(items.type).toBe("string");
		expect(items.minLength).toBe(3);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
//  2. if/then/else in pure subset check (without partial data)
//
//  The subset checker does NOT expand if/then/else into anyOf equivalent.
//  These tests document the consequences.
// ─────────────────────────────────────────────────────────────────────────────

describe("if/then/else — pure subset check (no data)", () => {
	const conditionalSchema: JSONSchema7 = {
		type: "object",
		properties: {
			kind: { type: "string" },
			value: {},
		},
		required: ["kind", "value"],
		if: {
			properties: { kind: { const: "text" } },
			required: ["kind"],
		},
		then: {
			properties: { value: { type: "string" } },
		},
		else: {
			properties: { value: { type: "number" } },
		},
	};

	test("A ⊆ A identity with if/then/else (fixed by identity short-circuit)", () => {
		// Identity should always hold. Previously failed due to merge artifacts
		// with if/then/else. Now fixed by identity short-circuit: same reference
		// or structurally equal after normalization → true without merge.
		const result = checker.isSubset(conditionalSchema, conditionalSchema);
		expect(result).toBe(true);
	});

	test("sub WITH conditions ⊆ sup WITHOUT conditions — works (conditions restrict)", () => {
		const supNoCondition: JSONSchema7 = {
			type: "object",
			properties: {
				kind: { type: "string" },
				value: {},
			},
			required: ["kind", "value"],
		};

		// Sub is more constrained (has if/then/else) → should be ⊆ sup
		const result = checker.isSubset(conditionalSchema, supNoCondition);
		expect(result).toBe(true);
	});

	test("sub WITHOUT conditions ⊄ sup WITH conditions — correctly detected", () => {
		const subNoCondition: JSONSchema7 = {
			type: "object",
			properties: {
				kind: { type: "string" },
				value: {},
			},
			required: ["kind", "value"],
		};

		// Sub is less constrained → should NOT be ⊆ sup
		const result = checker.isSubset(subNoCondition, conditionalSchema);
		expect(result).toBe(false);
	});

	test("sub matching then-branch ⊄ conditional sup — FALSE NEGATIVE without data", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				kind: { const: "text" },
				value: { type: "string" },
			},
			required: ["kind", "value"],
		};

		// This sub should be ⊆ conditionalSchema (it satisfies the "then" branch)
		// But without data resolution, the checker can't determine this
		const result = checker.isSubset(sub, conditionalSchema);
		// Document the actual behavior: false negative expected
		expect(result).toBe(false); // FALSE NEGATIVE — would be true with anyOf expansion
	});

	test("checkResolved FIXES the false negative when data is provided", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				kind: { const: "text" },
				value: { type: "string", minLength: 1 },
			},
			required: ["kind", "value"],
		};

		const result = checker.checkResolved(sub, conditionalSchema, {
			kind: "text",
		});
		expect(result.isSubset).toBe(true);
		expect(result.resolvedSup.branch).toBe("then");
	});

	test("strip if/then/else from SUB is safe (conservative) — document behavior", () => {
		// If we manually strip if/then/else from sub, the result is safe:
		// stripped_sub ⊆ sup → real_sub ⊆ sup (correct positive)
		// stripped_sub ⊄ sup → inconclusive (possible false negative)
		const strippedSub: JSONSchema7 = {
			type: "object",
			properties: {
				kind: { type: "string" },
				value: {},
			},
			required: ["kind", "value"],
		};

		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				kind: { type: "string" },
				value: {},
			},
			required: ["kind"],
		};

		// stripped_sub ⊆ sup → safe conclusion: real conditional sub ⊆ sup too
		expect(checker.isSubset(strippedSub, sup)).toBe(true);
	});

	test("strip if/then/else from SUP — sub without sup's extra property definitions is NOT subset", () => {
		// Scenario: sup has companyName: { type: "string" } in properties.
		// Even though companyName is NOT required in strippedSup,
		// its presence in properties means "if companyName exists, it must be string".
		// Sub doesn't define companyName at all → sub allows companyName of ANY type.
		// Therefore sub is LESS constrained than strippedSup for companyName → sub ⊄ strippedSup.
		//
		// This is actually CORRECT behavior from the checker — the merge adds
		// companyName: { type: "string" } to the result, making merged ≠ sub.
		const strippedSup: JSONSchema7 = {
			type: "object",
			properties: {
				accountType: { type: "string" },
				companyName: { type: "string" },
			},
			required: ["accountType"],
		};

		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				accountType: { const: "business" },
			},
			required: ["accountType"],
		};

		// NOT a false positive — the checker correctly detects that sub doesn't
		// constrain companyName to string, while strippedSup does.
		expect(checker.isSubset(sub, strippedSup)).toBe(false);
	});

	test("strip if/then/else from SUP IS dangerous when sub mirrors sup's properties", () => {
		// When sub defines ALL the same properties as strippedSup, THEN
		// stripping can produce a false positive (claiming subset when the
		// real conditional sup would reject it).
		const strippedSup: JSONSchema7 = {
			type: "object",
			properties: {
				accountType: { type: "string" },
				companyName: { type: "string" },
			},
			required: ["accountType"],
		};

		// Sub that defines companyName but doesn't require it
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				accountType: { const: "business" },
				companyName: { type: "string" },
			},
			required: ["accountType"],
		};

		// Against stripped sup: TRUE — but if the real sup required companyName
		// via if/then/else for accountType="business", this would be wrong.
		// This demonstrates the danger of stripping from sup.
		expect(checker.isSubset(sub, strippedSup)).toBe(true);
	});

	test("nested if/then/else in properties — fixed by identity short-circuit", () => {
		const schema: JSONSchema7 = {
			type: "object",
			properties: {
				config: {
					type: "object",
					properties: { mode: { type: "string" } },
					if: {
						properties: { mode: { const: "advanced" } },
					},
					then: {
						required: ["debug"],
						properties: { debug: { type: "boolean" } },
					},
				},
			},
		};

		// Identity check on schema with nested conditions
		const result = checker.isSubset(schema, schema);
		// Previously failed due to nested if/then/else merge artifacts.
		// Now fixed: identity short-circuit detects same reference → true.
		expect(result).toBe(true);
	});

	test("allOf containing if/then/else — fixed by identity short-circuit", () => {
		const schema: JSONSchema7 = {
			type: "object",
			properties: { x: { type: "string" } },
			allOf: [
				{
					if: { properties: { x: { const: "a" } } },
					then: { required: ["y"] },
				},
			],
		};

		const result = checker.isSubset(schema, schema);
		// Previously failed due to allOf merge artifacts with if/then/else.
		// Now fixed: identity short-circuit detects same reference → true.
		expect(result).toBe(true);
	});
});
