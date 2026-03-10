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
//
// Constraints are a RUNTIME-ONLY concept. They represent custom validators
// (e.g. "IsUuid", "NotFoundConstraint") that can only be evaluated against
// concrete data. The static path (normalize, merge, subset check, semantic
// errors) completely ignores them:
//
//   - `normalize()` strips `constraints` from schemas
//   - `engine.merge()` no longer applies constraint union/dedup post-processing
//   - `isSubset()` / `check()` see schemas without constraints
//   - Semantic errors never report constraint mismatches
//
// Runtime validation (`validateSchemaConstraints`) still evaluates constraints
// when `check()` is called with `{ data, validate: true }`.

// ── Intersect — constraints stripped from result ─────────────────────────────
//
// `checker.intersect()` calls `normalize()` on both inputs, which strips
// the `constraints` keyword. The intersection result therefore never
// contains constraints, regardless of what the inputs had.

describe("intersect — constraints stripped from result", () => {
	test("disjoint constraints are stripped from intersection result", () => {
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
		expect(result.constraints).toBeUndefined();
	});

	test("identical constraints are stripped from intersection result", () => {
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
		expect(result.constraints).toBeUndefined();
	});

	test("object constraints are stripped from intersection result", () => {
		const a: JSONSchema7 = {
			type: "string",
			constraints: [{ name: "MinAge", params: { min: 18 } }],
		};
		const b: JSONSchema7 = {
			type: "string",
			constraints: [{ name: "MinAge", params: { min: 21 } }],
		};

		const result = checker.intersect(a, b) as JSONSchema7;

		expect(result.type).toBe("string");
		expect(result.constraints).toBeUndefined();
	});

	test("constraints on one side only are stripped", () => {
		const a: JSONSchema7 = {
			type: "string",
			constraints: ["IsUuid"],
		};
		const b: JSONSchema7 = {
			type: "string",
		};

		const result = checker.intersect(a, b) as JSONSchema7;

		expect(result.type).toBe("string");
		expect(result.constraints).toBeUndefined();
	});

	test("constraints on sup side only are stripped", () => {
		const a: JSONSchema7 = {
			type: "string",
		};
		const b: JSONSchema7 = {
			type: "string",
			constraints: ["IsEmail"],
		};

		const result = checker.intersect(a, b) as JSONSchema7;

		expect(result.type).toBe("string");
		expect(result.constraints).toBeUndefined();
	});

	test("neither side has constraints → no constraints in result", () => {
		const a: JSONSchema7 = { type: "string" };
		const b: JSONSchema7 = { type: "string" };

		const result = checker.intersect(a, b) as JSONSchema7;

		expect(result.constraints).toBeUndefined();
	});

	test("mixed simple and object constraints are all stripped", () => {
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

		expect(result.type).toBe("string");
		expect(result.constraints).toBeUndefined();
	});

	test("single constraint (non-array) is stripped", () => {
		const a: JSONSchema7 = {
			type: "string",
			constraints: "IsUuid",
		};
		const b: JSONSchema7 = {
			type: "string",
			constraints: "BelongsToScope",
		};

		const result = checker.intersect(a, b) as JSONSchema7;

		expect(result.type).toBe("string");
		expect(result.constraints).toBeUndefined();
	});
});

// ── Subset checking with constraints ─────────────────────────────────────────
//
// Since normalize() strips constraints before the subset check,
// constraints have NO effect on isSubset(). Two schemas that differ
// only by constraints are structurally equivalent.

describe("subset checking — constraints ignored in static path", () => {
	test("A with constraints ⊆ B without constraints", () => {
		const sub: JSONSchema7 = {
			type: "string",
			constraints: ["IsUuid"],
		};
		const sup: JSONSchema7 = {
			type: "string",
		};

		expect(checker.isSubset(sub, sup)).toBe(true);
	});

	test("A without constraints ⊆ B with constraints (constraints ignored)", () => {
		const sub: JSONSchema7 = {
			type: "string",
		};
		const sup: JSONSchema7 = {
			type: "string",
			constraints: ["IsUuid"],
		};

		// Previously this was false — now constraints are ignored statically
		expect(checker.isSubset(sub, sup)).toBe(true);
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

	test("A has superset of constraints → A ⊆ B", () => {
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

	test("A has subset of constraints → A ⊆ B (constraints ignored)", () => {
		const sub: JSONSchema7 = {
			type: "string",
			constraints: ["IsUuid"],
		};
		const sup: JSONSchema7 = {
			type: "string",
			constraints: ["IsUuid", "BelongsToScope"],
		};

		// Previously this was false — now constraints are ignored statically
		expect(checker.isSubset(sub, sup)).toBe(true);
	});

	test("A and B have different constraints → both are subsets of each other (constraints ignored)", () => {
		const a: JSONSchema7 = {
			type: "string",
			constraints: ["IsUuid"],
		};
		const b: JSONSchema7 = {
			type: "string",
			constraints: ["IsEmail"],
		};

		// Previously both were false — now constraints are ignored statically
		expect(checker.isSubset(a, b)).toBe(true);
		expect(checker.isSubset(b, a)).toBe(true);
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

	test("constraints on nested properties are ignored for subset check", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				accountId: { type: "string" },
			},
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				accountId: {
					type: "string",
					constraints: ["NotFoundConstraint"],
				},
			},
		};

		// This is the exact user-reported bug scenario:
		// output (sub) has accountId: string, input (sup) has accountId: string + constraint.
		// The static check should pass — constraints are runtime-only.
		expect(checker.isSubset(sub, sup)).toBe(true);
	});
});

// ── Overlay (deep spread / last-writer-wins) ─────────────────────────────────
//
// Overlay does NOT go through normalize() — it's a raw schema operation.
// Constraints from override replace those from base when present.
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

// ── Overlay vs Intersect — semantic difference ───────────────────────────────

describe("overlay vs intersect — constraints semantic difference", () => {
	test("intersect strips constraints, overlay preserves them", () => {
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

		// Intersect: normalize() strips constraints → result has no constraints
		const intersected = checker.intersect(schemaA, schemaB) as JSONSchema7;
		const intersectedProps = intersected.properties as Record<
			string,
			JSONSchema7
		>;
		const intersectedValue = intersectedProps.value as JSONSchema7;

		expect(intersectedValue.constraints).toBeUndefined();

		// Overlay: last-writer-wins → only B's constraints
		const overlaid = engine.overlay(schemaA, schemaB) as JSONSchema7;
		const overlaidProps = overlaid.properties as Record<string, JSONSchema7>;
		const overlaidValue = overlaidProps.value as JSONSchema7;

		expect(overlaidValue.constraints).toEqual(["BelongsToScope"]);
	});
});

// ── Immutability ─────────────────────────────────────────────────────────────

describe("constraints — immutability", () => {
	test("intersect does not mutate input constraints arrays", () => {
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

// ── Intersect — constraints in nested locations are stripped ──────────────────

describe("intersect — constraints in patternProperties stripped", () => {
	test("constraints inside same-pattern patternProperties are stripped", () => {
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

		expect(pp.type).toBe("string");
		expect(pp.constraints).toBeUndefined();
	});

	test("constraints on one side only in patternProperties are stripped", () => {
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

		expect(pp.type).toBe("string");
		expect(pp.constraints).toBeUndefined();
	});
});

describe("intersect — constraints in tuple items stripped", () => {
	test("constraints inside tuple items are stripped", () => {
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

		expect(first.type).toBe("string");
		expect(first.constraints).toBeUndefined();
	});

	test("constraints on only one side of a tuple item are stripped", () => {
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

		expect(first.type).toBe("string");
		expect(first.constraints).toBeUndefined();
	});
});

describe("intersect — constraints in dependencies (schema form) stripped", () => {
	test("constraints inside schema-form dependencies are stripped", () => {
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

		expect(bar.type).toBe("string");
		expect(bar.constraints).toBeUndefined();
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
