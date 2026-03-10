import { beforeAll, describe, expect, test } from "bun:test";
import type { JSONSchema7 } from "json-schema";
import { JsonSchemaCompatibilityChecker, MergeEngine } from "../../src";
import type { Constraint } from "../../src/types.ts";

let checker: JsonSchemaCompatibilityChecker;
let engine: MergeEngine;

beforeAll(() => {
	checker = new JsonSchemaCompatibilityChecker();
	engine = new MergeEngine();
});

// ═══════════════════════════════════════════════════════════════════════════════
//  Merge engine — constraints custom keyword handling
// ═══════════════════════════════════════════════════════════════════════════════

// ── Merge (intersection / allOf) ─────────────────────────────────────────────
//
// Semantics: A ∩ B — a value must satisfy BOTH schemas simultaneously.
// Therefore constraints from both sides must be accumulated (union),
// deduplicated by deep equality.

describe("merge — constraints (intersection)", () => {
	test("disjoint constraints are unioned", () => {
		const a: JSONSchema7 = {
			type: "string",
			constraints: ["IsUuid"],
		};
		const b: JSONSchema7 = {
			type: "string",
			constraints: ["BelongsToScope"],
		};

		const result = checker.intersect(a, b) as JSONSchema7;

		expect(result.type).toBe("string");
		expect(result.constraints).toBeArrayOfSize(2);
		expect(result.constraints).toContain("IsUuid");
		expect(result.constraints).toContain("BelongsToScope");
	});

	test("identical simple constraints are deduplicated", () => {
		const a: JSONSchema7 = {
			type: "string",
			constraints: ["IsUuid"],
		};
		const b: JSONSchema7 = {
			type: "string",
			constraints: ["IsUuid"],
		};

		const result = checker.intersect(a, b) as JSONSchema7;

		expect(result.type).toBe("string");
		expect(result.constraints).toBeArrayOfSize(1);
		expect(result.constraints).toContain("IsUuid");
	});

	test("identical object constraints (same name + same params) are deduplicated", () => {
		const a: JSONSchema7 = {
			type: "string",
			constraints: [{ name: "MinAge", params: { min: 18 } }],
		};
		const b: JSONSchema7 = {
			type: "string",
			constraints: [{ name: "MinAge", params: { min: 18 } }],
		};

		const result = checker.intersect(a, b) as JSONSchema7;

		expect(result.constraints).toBeArrayOfSize(1);
		expect(result.constraints).toEqual([
			{ name: "MinAge", params: { min: 18 } },
		]);
	});

	test("object constraints with same name but different params are both kept", () => {
		const a: JSONSchema7 = {
			type: "string",
			constraints: [{ name: "MinAge", params: { min: 18 } }],
		};
		const b: JSONSchema7 = {
			type: "string",
			constraints: [{ name: "MinAge", params: { min: 21 } }],
		};

		const result = checker.intersect(a, b) as JSONSchema7;

		expect(result.constraints).toBeArrayOfSize(2);
		expect(result.constraints).toContainEqual({
			name: "MinAge",
			params: { min: 18 },
		});
		expect(result.constraints).toContainEqual({
			name: "MinAge",
			params: { min: 21 },
		});
	});

	test("constraints on one side only are preserved", () => {
		const a: JSONSchema7 = {
			type: "string",
			constraints: ["IsUuid"],
		};
		const b: JSONSchema7 = {
			type: "string",
		};

		const result = checker.intersect(a, b) as JSONSchema7;

		expect(result.type).toBe("string");
		expect(result.constraints).toBeArrayOfSize(1);
		expect(result.constraints).toContain("IsUuid");
	});

	test("constraints on sup side only are added in merge", () => {
		const a: JSONSchema7 = {
			type: "string",
		};
		const b: JSONSchema7 = {
			type: "string",
			constraints: ["IsEmail"],
		};

		const result = checker.intersect(a, b) as JSONSchema7;

		expect(result.type).toBe("string");
		expect(result.constraints).toBeArrayOfSize(1);
		expect(result.constraints).toContain("IsEmail");
	});

	test("neither side has constraints → no constraints in result", () => {
		const a: JSONSchema7 = { type: "string" };
		const b: JSONSchema7 = { type: "string" };

		const result = checker.intersect(a, b) as JSONSchema7;

		expect(result.constraints).toBeUndefined();
	});

	test("merge is commutative for constraints", () => {
		const a: JSONSchema7 = {
			type: "string",
			constraints: ["IsUuid", { name: "MaxLen", params: { max: 100 } }],
		};
		const b: JSONSchema7 = {
			type: "string",
			constraints: ["IsEmail", { name: "MaxLen", params: { max: 100 } }],
		};

		const resultAB = checker.intersect(a, b) as JSONSchema7;
		const resultBA = checker.intersect(b, a) as JSONSchema7;

		// Both should have 3 constraints (IsUuid, IsEmail, MaxLen — MaxLen deduplicated)
		expect(resultAB.constraints).toBeArrayOfSize(3);
		expect(resultBA.constraints).toBeArrayOfSize(3);

		const abArr = resultAB.constraints as Constraint[];
		const baArr = resultBA.constraints as Constraint[];

		// Same set of constraints regardless of order
		for (const c of abArr) {
			expect(baArr).toContainEqual(c);
		}
		for (const c of baArr) {
			expect(abArr).toContainEqual(c);
		}
	});

	test("mixed simple and object constraints are unioned and deduplicated", () => {
		const a: JSONSchema7 = {
			type: "string",
			constraints: [
				"IsUuid",
				{ name: "IsCustom", params: { message: "Hello" } },
			],
		};
		const b: JSONSchema7 = {
			type: "string",
			constraints: [
				"IsUuid",
				"BelongsToScope",
				{ name: "IsCustom", params: { message: "Hello" } },
				{ name: "IsCustom", params: { message: "World" } },
			],
		};

		const result = checker.intersect(a, b) as JSONSchema7;

		// IsUuid (deduped), BelongsToScope, IsCustom/Hello (deduped), IsCustom/World
		expect(result.constraints).toBeArrayOfSize(4);
		expect(result.constraints).toContainEqual("IsUuid");
		expect(result.constraints).toContainEqual("BelongsToScope");
		expect(result.constraints).toContainEqual({
			name: "IsCustom",
			params: { message: "Hello" },
		});
		expect(result.constraints).toContainEqual({
			name: "IsCustom",
			params: { message: "World" },
		});
	});

	test("empty constraints array treated as no constraints", () => {
		const a: JSONSchema7 = {
			type: "string",
			constraints: [],
		};
		const b: JSONSchema7 = {
			type: "string",
			constraints: ["IsUuid"],
		};

		const result = checker.intersect(a, b) as JSONSchema7;

		expect(result.constraints).toBeArrayOfSize(1);
		expect(result.constraints).toContain("IsUuid");
	});

	test("single constraint (non-array) is normalized into array for merge", () => {
		const a: JSONSchema7 = {
			type: "string",
			constraints: "IsUuid",
		};
		const b: JSONSchema7 = {
			type: "string",
			constraints: "BelongsToScope",
		};

		const result = checker.intersect(a, b) as JSONSchema7;

		expect(result.constraints).toBeArrayOfSize(2);
		expect(result.constraints).toContainEqual("IsUuid");
		expect(result.constraints).toContainEqual("BelongsToScope");
	});

	test("single constraint merged with array constraints", () => {
		const a: JSONSchema7 = {
			type: "string",
			constraints: "IsUuid",
		};
		const b: JSONSchema7 = {
			type: "string",
			constraints: ["IsEmail", "BelongsToScope"],
		};

		const result = checker.intersect(a, b) as JSONSchema7;

		expect(result.constraints).toBeArrayOfSize(3);
		expect(result.constraints).toContainEqual("IsUuid");
		expect(result.constraints).toContainEqual("IsEmail");
		expect(result.constraints).toContainEqual("BelongsToScope");
	});
});

// ── Subset checking with constraints ─────────────────────────────────────────
//
// A ⊆ B ⟺ merge(A, B) ≡ A
// More constraints = smaller set of valid values = easier to be a subset.

describe("subset checking — constraints", () => {
	test("A with constraints ⊆ B without constraints (A is more constrained)", () => {
		const sub: JSONSchema7 = {
			type: "string",
			constraints: ["IsUuid"],
		};
		const sup: JSONSchema7 = {
			type: "string",
		};

		expect(checker.isSubset(sub, sup)).toBe(true);
	});

	test("A without constraints ⊄ B with constraints (A is less constrained)", () => {
		const sub: JSONSchema7 = {
			type: "string",
		};
		const sup: JSONSchema7 = {
			type: "string",
			constraints: ["IsUuid"],
		};

		expect(checker.isSubset(sub, sup)).toBe(false);
	});

	test("identical constraints → A ⊆ B", () => {
		const sub: JSONSchema7 = {
			type: "string",
			constraints: ["IsUuid"],
		};
		const sup: JSONSchema7 = {
			type: "string",
			constraints: ["IsUuid"],
		};

		expect(checker.isSubset(sub, sup)).toBe(true);
	});

	test("A has superset of constraints → A ⊆ B (A is stricter)", () => {
		const sub: JSONSchema7 = {
			type: "string",
			constraints: ["IsUuid", "BelongsToScope"],
		};
		const sup: JSONSchema7 = {
			type: "string",
			constraints: ["IsUuid"],
		};

		expect(checker.isSubset(sub, sup)).toBe(true);
	});

	test("A has subset of constraints → A ⊄ B (A is less strict)", () => {
		const sub: JSONSchema7 = {
			type: "string",
			constraints: ["IsUuid"],
		};
		const sup: JSONSchema7 = {
			type: "string",
			constraints: ["IsUuid", "BelongsToScope"],
		};

		expect(checker.isSubset(sub, sup)).toBe(false);
	});

	test("A and B have different constraints → neither is subset", () => {
		const a: JSONSchema7 = {
			type: "string",
			constraints: ["IsUuid"],
		};
		const b: JSONSchema7 = {
			type: "string",
			constraints: ["IsEmail"],
		};

		expect(checker.isSubset(a, b)).toBe(false);
		expect(checker.isSubset(b, a)).toBe(false);
	});

	test("single constraint form ⊆ array constraint form (normalized)", () => {
		const sub: JSONSchema7 = { type: "string", constraints: "IsUuid" };
		const sup: JSONSchema7 = { type: "string", constraints: ["IsUuid"] };
		expect(checker.isSubset(sub, sup)).toBe(true);
	});

	test("array constraint form ⊆ single constraint form (normalized)", () => {
		const sub: JSONSchema7 = { type: "string", constraints: ["IsUuid"] };
		const sup: JSONSchema7 = { type: "string", constraints: "IsUuid" };
		expect(checker.isSubset(sub, sup)).toBe(true);
	});
});

// ── Overlay (deep spread / last-writer-wins) ─────────────────────────────────
//
// Semantics: { ...base, ...override } — override replaces entirely.
// constraints from override replace those from base when present.
// When override does not specify constraints, base constraints are kept.

describe("overlay — constraints (last-writer-wins)", () => {
	test("override constraints replace base constraints", () => {
		const base: JSONSchema7 = {
			type: "object",
			properties: {
				accountId: {
					type: "string",
					constraints: ["IsUuid", "BelongsToScope"],
				},
			},
			required: ["accountId"],
		};
		const override: JSONSchema7 = {
			type: "object",
			properties: {
				accountId: {
					type: "string",
					constraints: ["IsEmail"],
				},
			},
			required: ["accountId"],
		};

		const result = engine.overlay(base, override) as JSONSchema7;
		const props = result.properties as Record<string, JSONSchema7>;
		const accountId = props.accountId as JSONSchema7;

		expect(accountId.type).toBe("string");
		expect(accountId.constraints).toBeArrayOfSize(1);
		expect(accountId.constraints).toContain("IsEmail");
	});

	test("override without constraints → base constraints preserved", () => {
		const base: JSONSchema7 = {
			type: "object",
			properties: {
				accountId: {
					type: "string",
					constraints: ["IsUuid"],
				},
			},
			required: ["accountId"],
		};
		const override: JSONSchema7 = {
			type: "object",
			properties: {
				name: { type: "string" },
			},
		};

		const result = engine.overlay(base, override) as JSONSchema7;
		const props = result.properties as Record<string, JSONSchema7>;
		const accountId = props.accountId as JSONSchema7;

		expect(accountId.constraints).toBeArrayOfSize(1);
		expect(accountId.constraints).toContain("IsUuid");
	});

	test("override with empty constraints replaces base constraints", () => {
		const base: JSONSchema7 = {
			type: "object",
			properties: {
				accountId: {
					type: "string",
					constraints: ["IsUuid"],
				},
			},
		};
		const override: JSONSchema7 = {
			type: "object",
			properties: {
				accountId: {
					type: "string",
					constraints: [],
				},
			},
		};

		const result = engine.overlay(base, override) as JSONSchema7;
		const props = result.properties as Record<string, JSONSchema7>;
		const accountId = props.accountId as JSONSchema7;

		expect(accountId.constraints).toEqual([]);
	});

	test("overlay is NOT commutative for constraints", () => {
		const schemaA: JSONSchema7 = {
			type: "object",
			properties: {
				value: {
					type: "string",
					constraints: ["IsUuid"],
				},
			},
		};
		const schemaB: JSONSchema7 = {
			type: "object",
			properties: {
				value: {
					type: "string",
					constraints: ["IsEmail"],
				},
			},
		};

		const ab = engine.overlay(schemaA, schemaB) as JSONSchema7;
		const ba = engine.overlay(schemaB, schemaA) as JSONSchema7;

		const abProps = ab.properties as Record<string, JSONSchema7>;
		const baProps = ba.properties as Record<string, JSONSchema7>;

		// overlay(A, B) → B's constraints win
		expect(abProps.value?.constraints).toEqual(["IsEmail"]);
		// overlay(B, A) → A's constraints win
		expect(baProps.value?.constraints).toEqual(["IsUuid"]);
	});

	test("pipeline: reduce with overlay accumulates then overrides constraints", () => {
		const node1Output: JSONSchema7 = {
			type: "object",
			properties: {
				accountId: {
					type: "string",
					constraints: ["IsUuid"],
				},
				name: {
					type: "string",
					constraints: [{ name: "MinLength", params: { min: 3 } }],
				},
			},
			required: ["accountId", "name"],
		};

		const node2Output: JSONSchema7 = {
			type: "object",
			properties: {
				accountId: {
					type: "string",
					constraints: ["IsEmail"],
				},
				email: {
					type: "string",
					constraints: ["IsEmail"],
				},
			},
			required: ["accountId", "email"],
		};

		const outputs = [node1Output, node2Output];
		const context = outputs.reduce(
			(acc, output) => engine.overlay(acc, output) as JSONSchema7,
			{} as JSONSchema7,
		);

		const props = context.properties as Record<string, JSONSchema7>;

		// accountId: node2 overrode → IsEmail only
		expect(props.accountId?.constraints).toEqual(["IsEmail"]);

		// name: only node1 set it, node2 didn't override → preserved
		expect(props.name?.constraints).toEqual([
			{ name: "MinLength", params: { min: 3 } },
		]);

		// email: from node2
		expect(props.email?.constraints).toEqual(["IsEmail"]);
	});
});

// ── Overlay vs Merge — semantic difference for constraints ───────────────────

describe("overlay vs merge — constraints semantic difference", () => {
	test("merge unions constraints, overlay replaces them", () => {
		const schemaA: JSONSchema7 = {
			type: "object",
			properties: {
				value: {
					type: "string",
					constraints: ["IsUuid"],
				},
			},
			required: ["value"],
		};
		const schemaB: JSONSchema7 = {
			type: "object",
			properties: {
				value: {
					type: "string",
					constraints: ["BelongsToScope"],
				},
			},
			required: ["value"],
		};

		// Merge: intersection → both constraints apply
		const merged = checker.intersect(schemaA, schemaB) as JSONSchema7;
		const mergedProps = merged.properties as Record<string, JSONSchema7>;
		const mergedValue = mergedProps.value as JSONSchema7;

		expect(mergedValue.constraints).toBeArrayOfSize(2);
		expect(mergedValue.constraints).toContainEqual("IsUuid");
		expect(mergedValue.constraints).toContainEqual("BelongsToScope");

		// Overlay: last-writer-wins → only B's constraints
		const overlaid = engine.overlay(schemaA, schemaB) as JSONSchema7;
		const overlaidProps = overlaid.properties as Record<string, JSONSchema7>;
		const overlaidValue = overlaidProps.value as JSONSchema7;

		expect(overlaidValue.constraints).toEqual(["BelongsToScope"]);
	});
});

// ── Immutability ─────────────────────────────────────────────────────────────

describe("constraints — immutability", () => {
	test("merge does not mutate input constraints arrays", () => {
		const a: JSONSchema7 = {
			type: "string",
			constraints: ["IsUuid"],
		};
		const b: JSONSchema7 = {
			type: "string",
			constraints: ["IsEmail"],
		};

		const aCopy = [...(a.constraints as Constraint[])];
		const bCopy = [...(b.constraints as Constraint[])];

		checker.intersect(a, b);

		expect(a.constraints).toEqual(aCopy as Constraint[]);
		expect(b.constraints).toEqual(bCopy as Constraint[]);
	});

	test("overlay does not mutate input constraints arrays", () => {
		const base: JSONSchema7 = {
			type: "object",
			properties: {
				id: { type: "string", constraints: ["IsUuid"] },
			},
		};
		const override: JSONSchema7 = {
			type: "object",
			properties: {
				id: { type: "string", constraints: ["IsEmail"] },
			},
		};

		const baseProps = base.properties as Record<string, JSONSchema7>;
		const overrideProps = override.properties as Record<string, JSONSchema7>;
		const baseCopy = [...(baseProps.id?.constraints as Constraint[])];
		const overrideCopy = [...(overrideProps.id?.constraints as Constraint[])];

		engine.overlay(base, override);

		expect(baseProps.id?.constraints).toEqual(baseCopy as Constraint[]);
		expect(overrideProps.id?.constraints).toEqual(overrideCopy as Constraint[]);
	});
});

// ── Merge — constraints in patternProperties ─────────────────────────────────

describe("merge — constraints in patternProperties", () => {
	test("constraints inside same-pattern patternProperties are unioned", () => {
		const a: JSONSchema7 = {
			type: "object",
			patternProperties: {
				"^x-": { type: "string", constraints: ["IsUuid"] },
			},
		};
		const b: JSONSchema7 = {
			type: "object",
			patternProperties: {
				"^x-": { type: "string", constraints: ["BelongsToScope"] },
			},
		};

		const result = checker.intersect(a, b) as JSONSchema7;
		const pp = (result.patternProperties as Record<string, JSONSchema7>)[
			"^x-"
		] as JSONSchema7;

		expect(pp.constraints).toBeArrayOfSize(2);
		expect(pp.constraints).toContainEqual("IsUuid");
		expect(pp.constraints).toContainEqual("BelongsToScope");
	});

	test("constraints deduplicated across patternProperties", () => {
		const a: JSONSchema7 = {
			type: "object",
			patternProperties: {
				"^x-": { type: "string", constraints: ["IsUuid"] },
			},
		};
		const b: JSONSchema7 = {
			type: "object",
			patternProperties: {
				"^x-": { type: "string", constraints: ["IsUuid"] },
			},
		};

		const result = checker.intersect(a, b) as JSONSchema7;
		const pp = (result.patternProperties as Record<string, JSONSchema7>)[
			"^x-"
		] as JSONSchema7;

		expect(pp.constraints).toBeArrayOfSize(1);
		expect(pp.constraints).toContainEqual("IsUuid");
	});

	test("constraints on one side only in patternProperties are preserved", () => {
		const a: JSONSchema7 = {
			type: "object",
			patternProperties: {
				"^x-": { type: "string", constraints: ["IsUuid"] },
			},
		};
		const b: JSONSchema7 = {
			type: "object",
			patternProperties: {
				"^x-": { type: "string" },
			},
		};

		const result = checker.intersect(a, b) as JSONSchema7;
		const pp = (result.patternProperties as Record<string, JSONSchema7>)[
			"^x-"
		] as JSONSchema7;

		expect(pp.constraints).toBeArrayOfSize(1);
		expect(pp.constraints).toContainEqual("IsUuid");
	});
});

// ── Merge — constraints in tuple items ───────────────────────────────────────

describe("merge — constraints in tuple items", () => {
	test("constraints inside tuple items at same index are unioned", () => {
		const a: JSONSchema7 = {
			type: "array",
			items: [{ type: "string", constraints: ["IsUuid"] }, { type: "number" }],
		};
		const b: JSONSchema7 = {
			type: "array",
			items: [{ type: "string", constraints: ["IsEmail"] }, { type: "number" }],
		};

		const result = checker.intersect(a, b) as JSONSchema7;
		const items = result.items as JSONSchema7[];
		const first = items[0] as JSONSchema7;

		expect(first.constraints).toBeArrayOfSize(2);
		expect(first.constraints).toContainEqual("IsUuid");
		expect(first.constraints).toContainEqual("IsEmail");
	});

	test("constraints on only one side of a tuple item are preserved", () => {
		const a: JSONSchema7 = {
			type: "array",
			items: [{ type: "string", constraints: ["IsUuid"] }],
		};
		const b: JSONSchema7 = {
			type: "array",
			items: [{ type: "string" }],
		};

		const result = checker.intersect(a, b) as JSONSchema7;
		const items = result.items as JSONSchema7[];
		const first = items[0] as JSONSchema7;

		expect(first.constraints).toBeArrayOfSize(1);
		expect(first.constraints).toContainEqual("IsUuid");
	});

	test("constraints deduplicated across tuple items", () => {
		const a: JSONSchema7 = {
			type: "array",
			items: [{ type: "string", constraints: ["IsUuid"] }],
		};
		const b: JSONSchema7 = {
			type: "array",
			items: [{ type: "string", constraints: ["IsUuid"] }],
		};

		const result = checker.intersect(a, b) as JSONSchema7;
		const items = result.items as JSONSchema7[];
		const first = items[0] as JSONSchema7;

		expect(first.constraints).toBeArrayOfSize(1);
		expect(first.constraints).toContainEqual("IsUuid");
	});
});

// ── Merge — constraints in dependencies (schema form) ────────────────────────

describe("merge — constraints in dependencies (schema form)", () => {
	test("constraints inside schema-form dependencies are unioned", () => {
		const a: JSONSchema7 = {
			type: "object",
			dependencies: {
				foo: {
					properties: {
						bar: { type: "string", constraints: ["IsUuid"] },
					},
				},
			},
		};
		const b: JSONSchema7 = {
			type: "object",
			dependencies: {
				foo: {
					properties: {
						bar: { type: "string", constraints: ["IsEmail"] },
					},
				},
			},
		};

		const result = checker.intersect(a, b) as JSONSchema7;
		const dep = (result.dependencies as Record<string, JSONSchema7>)
			.foo as JSONSchema7;
		const bar = (dep.properties as Record<string, JSONSchema7>)
			.bar as JSONSchema7;

		expect(bar.constraints).toBeArrayOfSize(2);
		expect(bar.constraints).toContainEqual("IsUuid");
		expect(bar.constraints).toContainEqual("IsEmail");
	});

	test("array-form dependencies are left untouched", () => {
		const a: JSONSchema7 = {
			type: "object",
			dependencies: { foo: ["bar"] },
		};
		const b: JSONSchema7 = {
			type: "object",
			dependencies: { foo: ["baz"] },
		};

		const result = checker.intersect(a, b) as JSONSchema7;
		const dep = (result.dependencies as Record<string, string[]>)
			.foo as string[];

		// Array-form deps are unioned by the merge engine (not constraints logic)
		expect(dep).toContain("bar");
		expect(dep).toContain("baz");
	});

	test("constraints deduplicated across schema-form dependencies", () => {
		const a: JSONSchema7 = {
			type: "object",
			dependencies: {
				foo: {
					properties: {
						bar: { type: "string", constraints: ["IsUuid"] },
					},
				},
			},
		};
		const b: JSONSchema7 = {
			type: "object",
			dependencies: {
				foo: {
					properties: {
						bar: { type: "string", constraints: ["IsUuid"] },
					},
				},
			},
		};

		const result = checker.intersect(a, b) as JSONSchema7;
		const dep = (result.dependencies as Record<string, JSONSchema7>)
			.foo as JSONSchema7;
		const bar = (dep.properties as Record<string, JSONSchema7>)
			.bar as JSONSchema7;

		expect(bar.constraints).toBeArrayOfSize(1);
		expect(bar.constraints).toContainEqual("IsUuid");
	});
});

// ── Overlay — constraints deep-spread at nested property level ────────────────
//
// Verifies that overlay deep-spreads constraints correctly when recursing into
// nested object properties (2+ levels). The semantics are { ...base, ...override }
// at each recursion level: absent key in override = base key preserved.

describe("overlay — constraints deep-spread at nested property level", () => {
	test("override touches nested non-object property without constraints → override replaces entirely", () => {
		// When both base and override property schemas are non-object-like (e.g. type: "string"),
		// overlay does NOT deep-spread — the override replaces the base entirely.
		// This means constraints from the base are lost.
		const base: JSONSchema7 = {
			type: "object",
			properties: {
				user: {
					type: "object",
					properties: {
						id: {
							type: "string",
							constraints: ["IsUuid"],
						},
						name: { type: "string" },
					},
					required: ["id", "name"],
				},
			},
			required: ["user"],
		};
		const override: JSONSchema7 = {
			type: "object",
			properties: {
				user: {
					type: "object",
					properties: {
						id: { type: "string", minLength: 1 },
					},
				},
			},
		};

		const result = engine.overlay(base, override) as JSONSchema7;
		const userProps = (result.properties as Record<string, JSONSchema7>)
			.user as JSONSchema7;
		const idProp = (userProps.properties as Record<string, JSONSchema7>)
			.id as JSONSchema7;

		// Both id schemas are non-object-like (type: "string"), so override replaces entirely.
		// Base constraints are NOT preserved — this is expected overlay behavior for leaf schemas.
		expect(idProp.constraints).toBeUndefined();
		// minLength from override should be applied
		expect(idProp.minLength).toBe(1);
		// type from override should be present
		expect(idProp.type).toBe("string");
	});

	test("override touches nested object-like property without constraints → base constraints preserved", () => {
		// When both base and override property schemas are object-like,
		// overlay recurses and deep-spreads: { ...base, ...override }.
		// Absent keys in the override are preserved from the base.
		const base: JSONSchema7 = {
			type: "object",
			properties: {
				user: {
					type: "object",
					properties: {
						address: {
							type: "object",
							properties: {
								street: { type: "string" },
							},
							constraints: ["IsValidAddress"],
						},
						name: { type: "string" },
					},
					required: ["address", "name"],
				},
			},
			required: ["user"],
		};
		const override: JSONSchema7 = {
			type: "object",
			properties: {
				user: {
					type: "object",
					properties: {
						address: {
							type: "object",
							properties: {
								zip: { type: "string" },
							},
						},
					},
				},
			},
		};

		const result = engine.overlay(base, override) as JSONSchema7;
		const userProps = (result.properties as Record<string, JSONSchema7>)
			.user as JSONSchema7;
		const addressProp = (userProps.properties as Record<string, JSONSchema7>)
			.address as JSONSchema7;

		// Both address schemas are object-like (type: "object" + properties),
		// so overlay recurses and deep-spreads — base constraints are preserved.
		expect(addressProp.constraints).toEqual(["IsValidAddress"]);
		expect(addressProp.type).toBe("object");
		// Both base and override sub-properties should be present
		const addrProps = addressProp.properties as Record<string, JSONSchema7>;
		expect(addrProps.street).toBeDefined();
		expect(addrProps.zip).toBeDefined();
	});

	test("override replaces nested property constraints (last-writer-wins)", () => {
		const base: JSONSchema7 = {
			type: "object",
			properties: {
				user: {
					type: "object",
					properties: {
						id: {
							type: "string",
							constraints: ["IsUuid", "BelongsToScope"],
						},
					},
					required: ["id"],
				},
			},
		};
		const override: JSONSchema7 = {
			type: "object",
			properties: {
				user: {
					type: "object",
					properties: {
						id: {
							type: "string",
							constraints: ["IsEmail"],
						},
					},
				},
			},
		};

		const result = engine.overlay(base, override) as JSONSchema7;
		const userProps = (result.properties as Record<string, JSONSchema7>)
			.user as JSONSchema7;
		const idProp = (userProps.properties as Record<string, JSONSchema7>)
			.id as JSONSchema7;

		// override's constraints win — NOT unioned
		expect(idProp.constraints).toEqual(["IsEmail"]);
	});

	test("override adds constraints to nested property that had none", () => {
		const base: JSONSchema7 = {
			type: "object",
			properties: {
				user: {
					type: "object",
					properties: {
						id: { type: "string" },
					},
					required: ["id"],
				},
			},
		};
		const override: JSONSchema7 = {
			type: "object",
			properties: {
				user: {
					type: "object",
					properties: {
						id: {
							type: "string",
							constraints: ["IsUuid"],
						},
					},
				},
			},
		};

		const result = engine.overlay(base, override) as JSONSchema7;
		const userProps = (result.properties as Record<string, JSONSchema7>)
			.user as JSONSchema7;
		const idProp = (userProps.properties as Record<string, JSONSchema7>)
			.id as JSONSchema7;

		expect(idProp.constraints).toEqual(["IsUuid"]);
	});

	test("deeply nested (3 levels) — constraints preserved through recursive overlay", () => {
		const base: JSONSchema7 = {
			type: "object",
			properties: {
				org: {
					type: "object",
					properties: {
						user: {
							type: "object",
							properties: {
								id: {
									type: "string",
									constraints: ["IsUuid"],
								},
								email: {
									type: "string",
									constraints: ["IsEmail"],
								},
							},
							required: ["id", "email"],
						},
					},
				},
			},
		};
		const override: JSONSchema7 = {
			type: "object",
			properties: {
				org: {
					type: "object",
					properties: {
						user: {
							type: "object",
							properties: {
								email: {
									type: "string",
									format: "email",
									constraints: ["IsCompanyEmail"],
								},
							},
						},
					},
				},
			},
		};

		const result = engine.overlay(base, override) as JSONSchema7;
		const orgProps = (result.properties as Record<string, JSONSchema7>)
			.org as JSONSchema7;
		const userProps = (orgProps.properties as Record<string, JSONSchema7>)
			.user as JSONSchema7;
		const idProp = (userProps.properties as Record<string, JSONSchema7>)
			.id as JSONSchema7;
		const emailProp = (userProps.properties as Record<string, JSONSchema7>)
			.email as JSONSchema7;

		// id was not touched by override → base constraints preserved
		expect(idProp.constraints).toEqual(["IsUuid"]);
		expect(idProp.type).toBe("string");

		// email was overridden → override's constraints win
		expect(emailProp.constraints).toEqual(["IsCompanyEmail"]);
		expect(emailProp.format).toBe("email");
	});

	test("mixed scenario — some nested properties overridden, some preserved", () => {
		const base: JSONSchema7 = {
			type: "object",
			properties: {
				user: {
					type: "object",
					properties: {
						id: {
							type: "string",
							constraints: ["IsUuid"],
						},
						name: {
							type: "string",
							constraints: [{ name: "MinLength", params: { min: 2 } }],
						},
						role: {
							type: "string",
							constraints: ["IsValidRole"],
						},
					},
					required: ["id", "name", "role"],
				},
			},
			required: ["user"],
		};
		const override: JSONSchema7 = {
			type: "object",
			properties: {
				user: {
					type: "object",
					properties: {
						// id is NOT in the override → base preserved
						name: {
							// override replaces constraints
							type: "string",
							constraints: [{ name: "MinLength", params: { min: 5 } }],
						},
						role: {
							// override removes constraints by not specifying them
							// but adds a format
							type: "string",
							format: "uri",
						},
					},
				},
			},
		};

		const result = engine.overlay(base, override) as JSONSchema7;
		const userProps = (result.properties as Record<string, JSONSchema7>)
			.user as JSONSchema7;
		const props = userProps.properties as Record<string, JSONSchema7>;

		// id: not in override → base constraints preserved
		expect(props.id?.constraints).toEqual(["IsUuid"]);

		// name: override replaces constraints with different params
		expect(props.name?.constraints).toEqual([
			{ name: "MinLength", params: { min: 5 } },
		]);

		// role: both base and override are non-object-like (type: "string"),
		// so override replaces entirely — base constraints are NOT preserved.
		expect(props.role?.constraints).toBeUndefined();
		expect(props.role?.format).toBe("uri");
	});

	test("override with empty constraints on nested property clears base constraints", () => {
		const base: JSONSchema7 = {
			type: "object",
			properties: {
				user: {
					type: "object",
					properties: {
						id: {
							type: "string",
							constraints: ["IsUuid"],
						},
					},
				},
			},
		};
		const override: JSONSchema7 = {
			type: "object",
			properties: {
				user: {
					type: "object",
					properties: {
						id: {
							type: "string",
							constraints: [],
						},
					},
				},
			},
		};

		const result = engine.overlay(base, override) as JSONSchema7;
		const userProps = (result.properties as Record<string, JSONSchema7>)
			.user as JSONSchema7;
		const idProp = (userProps.properties as Record<string, JSONSchema7>)
			.id as JSONSchema7;

		// explicit empty array in override clears the base constraints
		expect(idProp.constraints).toEqual([]);
	});
});
