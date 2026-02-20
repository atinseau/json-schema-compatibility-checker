import { beforeAll, describe, expect, test } from "bun:test";
import type { JSONSchema7, JSONSchema7Definition } from "json-schema";
import { JsonSchemaCompatibilityChecker } from "../../src";

let checker: JsonSchemaCompatibilityChecker;

beforeAll(() => {
	checker = new JsonSchemaCompatibilityChecker();
});

// ─────────────────────────────────────────────────────────────────────────────
//  propertyNames — behavior exploration
// ─────────────────────────────────────────────────────────────────────────────

describe("propertyNames — behavior exploration", () => {
	// ── Normalization ──────────────────────────────────────────────────────

	describe("normalization", () => {
		test("propertyNames sub-schema is normalized recursively (const infers type)", () => {
			const result = checker.normalize({
				type: "object",
				propertyNames: { const: "foo" },
			}) as JSONSchema7;
			const pn = result.propertyNames as JSONSchema7;
			expect(pn).toBeDefined();
			expect(pn.const).toBe("foo");
			expect(pn.type).toBe("string"); // type inferred from const
		});

		test("propertyNames with enum gets type inferred", () => {
			const result = checker.normalize({
				type: "object",
				propertyNames: { enum: ["alpha", "beta", "gamma"] },
			}) as JSONSchema7;
			const pn = result.propertyNames as JSONSchema7;
			expect(pn).toBeDefined();
			expect(pn.type).toBe("string");
		});

		test("propertyNames with nested not is normalized (double negation)", () => {
			const result = checker.normalize({
				type: "object",
				propertyNames: { not: { not: { pattern: "^[a-z]+$" } } },
			}) as JSONSchema7;
			const pn = result.propertyNames as JSONSchema7;
			// Double negation should be resolved: not(not(X)) → X
			expect(pn.pattern).toBe("^[a-z]+$");
			expect(pn.not).toBeUndefined();
		});

		test("propertyNames: boolean true passes through unchanged", () => {
			const result = checker.normalize({
				type: "object",
				propertyNames: true,
			}) as JSONSchema7;
			expect(result.propertyNames).toBe(true);
		});

		test("propertyNames: boolean false passes through unchanged", () => {
			const result = checker.normalize({
				type: "object",
				propertyNames: false,
			}) as JSONSchema7;
			expect(result.propertyNames).toBe(false);
		});
	});

	// ── isSubset ───────────────────────────────────────────────────────────

	describe("isSubset", () => {
		test("same propertyNames → subset (identity)", () => {
			const schema: JSONSchema7 = {
				type: "object",
				propertyNames: { pattern: "^[a-z]+$" },
			};
			expect(checker.isSubset(schema, schema)).toBe(true);
		});

		test("propertyNames with minLength ⊆ no propertyNames (more constrained ⊆ less constrained)", () => {
			const sub: JSONSchema7 = {
				type: "object",
				propertyNames: { minLength: 3 },
			};
			const sup: JSONSchema7 = {
				type: "object",
			};
			expect(checker.isSubset(sub, sup)).toBe(true);
		});

		test("no propertyNames ⊄ propertyNames with minLength (less constrained ⊄ more constrained)", () => {
			const sub: JSONSchema7 = {
				type: "object",
			};
			const sup: JSONSchema7 = {
				type: "object",
				propertyNames: { minLength: 3 },
			};
			expect(checker.isSubset(sub, sup)).toBe(false);
		});

		test("propertyNames with stricter minLength ⊆ propertyNames with looser minLength", () => {
			const sub: JSONSchema7 = {
				type: "object",
				propertyNames: { minLength: 5 },
			};
			const sup: JSONSchema7 = {
				type: "object",
				propertyNames: { minLength: 2 },
			};
			expect(checker.isSubset(sub, sup)).toBe(true);
		});

		test("propertyNames with looser minLength ⊄ propertyNames with stricter minLength", () => {
			const sub: JSONSchema7 = {
				type: "object",
				propertyNames: { minLength: 2 },
			};
			const sup: JSONSchema7 = {
				type: "object",
				propertyNames: { minLength: 5 },
			};
			expect(checker.isSubset(sub, sup)).toBe(false);
		});

		test("propertyNames with enum ⊆ no propertyNames", () => {
			const sub: JSONSchema7 = {
				type: "object",
				propertyNames: { enum: ["foo", "bar"] },
			};
			const sup: JSONSchema7 = {
				type: "object",
			};
			expect(checker.isSubset(sub, sup)).toBe(true);
		});

		test("no propertyNames ⊄ propertyNames with enum", () => {
			const sub: JSONSchema7 = {
				type: "object",
			};
			const sup: JSONSchema7 = {
				type: "object",
				propertyNames: { enum: ["foo", "bar"] },
			};
			expect(checker.isSubset(sub, sup)).toBe(false);
		});

		test("propertyNames with small enum ⊆ propertyNames with large enum", () => {
			const sub: JSONSchema7 = {
				type: "object",
				propertyNames: { enum: ["foo", "bar"] },
			};
			const sup: JSONSchema7 = {
				type: "object",
				propertyNames: { enum: ["foo", "bar", "baz"] },
			};
			expect(checker.isSubset(sub, sup)).toBe(true);
		});

		test("propertyNames with large enum ⊄ propertyNames with small enum", () => {
			const sub: JSONSchema7 = {
				type: "object",
				propertyNames: { enum: ["foo", "bar", "baz"] },
			};
			const sup: JSONSchema7 = {
				type: "object",
				propertyNames: { enum: ["foo", "bar"] },
			};
			expect(checker.isSubset(sub, sup)).toBe(false);
		});

		test("propertyNames with pattern ⊆ no propertyNames", () => {
			const sub: JSONSchema7 = {
				type: "object",
				propertyNames: { pattern: "^[a-z]+$" },
			};
			const sup: JSONSchema7 = {
				type: "object",
			};
			expect(checker.isSubset(sub, sup)).toBe(true);
		});

		test("no propertyNames ⊄ propertyNames with pattern", () => {
			const sub: JSONSchema7 = {
				type: "object",
			};
			const sup: JSONSchema7 = {
				type: "object",
				propertyNames: { pattern: "^[a-z]+$" },
			};
			expect(checker.isSubset(sub, sup)).toBe(false);
		});

		test("propertyNames: false ⊆ anything (no properties allowed — maximally constrained)", () => {
			const sub: JSONSchema7 = {
				type: "object",
				propertyNames: false as unknown as JSONSchema7Definition,
			};
			const sup: JSONSchema7 = {
				type: "object",
				propertyNames: { minLength: 1 },
			};
			expect(checker.isSubset(sub, sup)).toBe(true);
		});

		test("propertyNames with maxLength ⊆ no propertyNames", () => {
			const sub: JSONSchema7 = {
				type: "object",
				propertyNames: { maxLength: 10 },
			};
			const sup: JSONSchema7 = {
				type: "object",
			};
			expect(checker.isSubset(sub, sup)).toBe(true);
		});

		test("propertyNames with combined constraints ⊆ propertyNames with fewer constraints", () => {
			const sub: JSONSchema7 = {
				type: "object",
				propertyNames: { minLength: 3, maxLength: 10, pattern: "^[a-z]+$" },
			};
			const sup: JSONSchema7 = {
				type: "object",
				propertyNames: { minLength: 1 },
			};
			expect(checker.isSubset(sub, sup)).toBe(true);
		});
	});

	// ── intersect (merge) ──────────────────────────────────────────────────

	describe("intersect (merge)", () => {
		test("merge two propertyNames schemas combines constraints", () => {
			const result = checker.intersect(
				{ type: "object", propertyNames: { minLength: 2 } },
				{ type: "object", propertyNames: { maxLength: 10 } },
			);
			expect(result).not.toBeNull();
			const schema = result as JSONSchema7;
			const pn = schema.propertyNames as JSONSchema7;
			expect(pn).toBeDefined();
			expect(pn.minLength).toBe(2);
			expect(pn.maxLength).toBe(10);
		});

		test("merge propertyNames: tighter minLength wins", () => {
			const result = checker.intersect(
				{ type: "object", propertyNames: { minLength: 2 } },
				{ type: "object", propertyNames: { minLength: 5 } },
			);
			expect(result).not.toBeNull();
			const pn = (result as JSONSchema7).propertyNames as JSONSchema7;
			expect(pn.minLength).toBe(5);
		});

		test("merge propertyNames: tighter maxLength wins", () => {
			const result = checker.intersect(
				{ type: "object", propertyNames: { maxLength: 20 } },
				{ type: "object", propertyNames: { maxLength: 10 } },
			);
			expect(result).not.toBeNull();
			const pn = (result as JSONSchema7).propertyNames as JSONSchema7;
			expect(pn.maxLength).toBe(10);
		});

		test("merge propertyNames: pattern added from one side", () => {
			const result = checker.intersect(
				{ type: "object", propertyNames: { minLength: 1 } },
				{ type: "object", propertyNames: { pattern: "^[a-z]+$" } },
			);
			expect(result).not.toBeNull();
			const pn = (result as JSONSchema7).propertyNames as JSONSchema7;
			expect(pn.minLength).toBe(1);
			expect(pn.pattern).toBe("^[a-z]+$");
		});

		test("merge propertyNames from one side + none from the other → propertyNames preserved", () => {
			const result = checker.intersect(
				{ type: "object", propertyNames: { minLength: 3 } },
				{ type: "object" },
			);
			expect(result).not.toBeNull();
			const pn = (result as JSONSchema7).propertyNames as JSONSchema7;
			expect(pn).toBeDefined();
			expect(pn.minLength).toBe(3);
		});

		test("merge propertyNames enum intersection", () => {
			const result = checker.intersect(
				{ type: "object", propertyNames: { enum: ["a", "b", "c"] } },
				{ type: "object", propertyNames: { enum: ["b", "c", "d"] } },
			);
			expect(result).not.toBeNull();
			const pn = (result as JSONSchema7).propertyNames as JSONSchema7;
			expect(pn.enum).toBeDefined();
			// Should contain only common values
			expect(pn.enum).toContain("b");
			expect(pn.enum).toContain("c");
			expect(pn.enum).not.toContain("a");
			expect(pn.enum).not.toContain("d");
		});

		test("merge propertyNames with conflicting const → null", () => {
			const result = checker.intersect(
				{ type: "object", propertyNames: { const: "foo" } },
				{ type: "object", propertyNames: { const: "bar" } },
			);
			expect(result).toBeNull();
		});

		test("merge propertyNames with same const → preserved", () => {
			const result = checker.intersect(
				{ type: "object", propertyNames: { const: "id" } },
				{ type: "object", propertyNames: { const: "id" } },
			);
			expect(result).not.toBeNull();
			const pn = (result as JSONSchema7).propertyNames as JSONSchema7;
			expect(pn.const).toBe("id");
		});
	});

	// ── check (with diffs) ─────────────────────────────────────────────────

	describe("check (diffs)", () => {
		test("diff path traces through propertyNames when constraint is added", () => {
			const sub: JSONSchema7 = {
				type: "object",
			};
			const sup: JSONSchema7 = {
				type: "object",
				propertyNames: { minLength: 3 },
			};
			const result = checker.check(sub, sup);
			expect(result.isSubset).toBe(false);
			expect(result.diffs.length).toBeGreaterThan(0);
			// Should have a diff mentioning propertyNames
			const pnDiff = result.diffs.find((d) => d.path.includes("propertyNames"));
			expect(pnDiff).toBeDefined();
		});

		test("diff path traces through propertyNames.minLength when it changes", () => {
			const sub: JSONSchema7 = {
				type: "object",
				propertyNames: { minLength: 1 },
			};
			const sup: JSONSchema7 = {
				type: "object",
				propertyNames: { minLength: 5 },
			};
			const result = checker.check(sub, sup);
			expect(result.isSubset).toBe(false);
			expect(result.diffs.length).toBeGreaterThan(0);
			const diff = result.diffs.find((d) => d.path.includes("propertyNames"));
			expect(diff).toBeDefined();
		});

		test("no diff when propertyNames are identical", () => {
			const schema: JSONSchema7 = {
				type: "object",
				propertyNames: { pattern: "^[a-z]+$" },
			};
			const result = checker.check(schema, schema);
			expect(result.isSubset).toBe(true);
			expect(result.diffs).toHaveLength(0);
		});
	});

	// ── isEqual ────────────────────────────────────────────────────────────

	describe("isEqual", () => {
		test("schemas with same propertyNames are equal", () => {
			const a: JSONSchema7 = {
				type: "object",
				propertyNames: { minLength: 2, pattern: "^[a-z]+$" },
			};
			const b: JSONSchema7 = {
				type: "object",
				propertyNames: { minLength: 2, pattern: "^[a-z]+$" },
			};
			expect(checker.isEqual(a, b)).toBe(true);
		});

		test("schemas with different propertyNames are not equal", () => {
			const a: JSONSchema7 = {
				type: "object",
				propertyNames: { minLength: 2 },
			};
			const b: JSONSchema7 = {
				type: "object",
				propertyNames: { minLength: 5 },
			};
			expect(checker.isEqual(a, b)).toBe(false);
		});

		test("schema with propertyNames ≠ schema without propertyNames", () => {
			const a: JSONSchema7 = {
				type: "object",
				propertyNames: { minLength: 2 },
			};
			const b: JSONSchema7 = {
				type: "object",
			};
			expect(checker.isEqual(a, b)).toBe(false);
		});
	});

	// ── canConnect ─────────────────────────────────────────────────────────

	describe("canConnect", () => {
		test("source with propertyNames constraint → target without → connectable", () => {
			const source: JSONSchema7 = {
				type: "object",
				propertyNames: { pattern: "^[a-z_]+$" },
			};
			const target: JSONSchema7 = {
				type: "object",
			};
			const result = checker.canConnect(source, target);
			expect(result.isSubset).toBe(true);
		});

		test("source without propertyNames → target with → not connectable", () => {
			const source: JSONSchema7 = {
				type: "object",
			};
			const target: JSONSchema7 = {
				type: "object",
				propertyNames: { pattern: "^[a-z_]+$" },
			};
			const result = checker.canConnect(source, target);
			expect(result.isSubset).toBe(false);
		});
	});

	// ── Conflict detection (deep const conflict in propertyNames) ──────────

	describe("conflict detection", () => {
		test("conflicting const in propertyNames → intersect returns null", () => {
			const result = checker.intersect(
				{ type: "object", propertyNames: { const: "x" } },
				{ type: "object", propertyNames: { const: "y" } },
			);
			expect(result).toBeNull();
		});

		test("non-conflicting const in propertyNames → intersect returns schema", () => {
			const result = checker.intersect(
				{ type: "object", propertyNames: { const: "id" } },
				{ type: "object", propertyNames: { const: "id" } },
			);
			expect(result).not.toBeNull();
		});

		test("isSubset detects deep const conflict in propertyNames", () => {
			expect(
				checker.isSubset(
					{ type: "object", propertyNames: { const: "a" } },
					{ type: "object", propertyNames: { const: "b" } },
				),
			).toBe(false);
		});
	});

	// ── Combined with other object keywords ────────────────────────────────

	describe("combined with other object keywords", () => {
		test("propertyNames + properties + required: subset works", () => {
			const sub: JSONSchema7 = {
				type: "object",
				properties: {
					name: { type: "string" },
				},
				required: ["name"],
				propertyNames: { pattern: "^[a-z]+$" },
			};
			const sup: JSONSchema7 = {
				type: "object",
				properties: {
					name: { type: "string" },
				},
				required: ["name"],
			};
			// sub has extra constraint (propertyNames) so sub ⊆ sup
			expect(checker.isSubset(sub, sup)).toBe(true);
		});

		test("propertyNames + additionalProperties: false — both constrained", () => {
			const sub: JSONSchema7 = {
				type: "object",
				properties: {
					id: { type: "string" },
				},
				additionalProperties: false,
				propertyNames: { minLength: 1 },
			};
			const sup: JSONSchema7 = {
				type: "object",
				properties: {
					id: { type: "string" },
				},
				additionalProperties: false,
			};
			expect(checker.isSubset(sub, sup)).toBe(true);
		});

		test("propertyNames + minProperties: combined constraints", () => {
			const sub: JSONSchema7 = {
				type: "object",
				propertyNames: { minLength: 2 },
				minProperties: 3,
			};
			const sup: JSONSchema7 = {
				type: "object",
				propertyNames: { minLength: 1 },
				minProperties: 1,
			};
			expect(checker.isSubset(sub, sup)).toBe(true);
		});

		test("merge preserves propertyNames alongside other object keywords", () => {
			const result = checker.intersect(
				{
					type: "object",
					properties: { name: { type: "string" } },
					propertyNames: { minLength: 2 },
				},
				{
					type: "object",
					properties: { age: { type: "number" } },
					propertyNames: { maxLength: 20 },
				},
			);
			expect(result).not.toBeNull();
			const schema = result as JSONSchema7;
			expect(schema.properties).toBeDefined();
			expect(
				(schema.properties as Record<string, JSONSchema7Definition>).name,
			).toBeDefined();
			expect(
				(schema.properties as Record<string, JSONSchema7Definition>).age,
			).toBeDefined();
			const pn = schema.propertyNames as JSONSchema7;
			expect(pn.minLength).toBe(2);
			expect(pn.maxLength).toBe(20);
		});
	});

	// ── Edge cases ─────────────────────────────────────────────────────────

	describe("edge cases", () => {
		test("empty propertyNames {} ⊆ empty propertyNames {} (identity)", () => {
			const schema: JSONSchema7 = {
				type: "object",
				propertyNames: {},
			};
			expect(checker.isSubset(schema, schema)).toBe(true);
		});

		test("propertyNames: {} ⊆ no propertyNames (empty schema accepts all)", () => {
			const sub: JSONSchema7 = {
				type: "object",
				propertyNames: {},
			};
			const sup: JSONSchema7 = {
				type: "object",
			};
			expect(checker.isSubset(sub, sup)).toBe(true);
		});

		test("no propertyNames ⊆ propertyNames: {} (empty schema is equivalent to no constraint)", () => {
			const sub: JSONSchema7 = {
				type: "object",
			};
			const sup: JSONSchema7 = {
				type: "object",
				propertyNames: {},
			};
			// {} accepts everything, same as no constraint
			// But merge will add propertyNames: {} → merged ≠ sub → might be false
			// This test explores the actual behavior
			const result = checker.isSubset(sub, sup);
			// Document actual behavior:
			console.log(`  [edge] no propertyNames ⊆ propertyNames: {} → ${result}`);
			// Either behavior is interesting to document
		});

		test("propertyNames with type: string (explicit, redundant since names are always strings)", () => {
			const sub: JSONSchema7 = {
				type: "object",
				propertyNames: { type: "string", minLength: 3 },
			};
			const sup: JSONSchema7 = {
				type: "object",
				propertyNames: { type: "string" },
			};
			expect(checker.isSubset(sub, sup)).toBe(true);
		});

		test("propertyNames in nested object", () => {
			const sub: JSONSchema7 = {
				type: "object",
				properties: {
					config: {
						type: "object",
						propertyNames: { pattern: "^[a-z_]+$" },
					},
				},
			};
			const sup: JSONSchema7 = {
				type: "object",
				properties: {
					config: {
						type: "object",
					},
				},
			};
			expect(checker.isSubset(sub, sup)).toBe(true);
		});

		test("nested: no propertyNames ⊄ nested propertyNames", () => {
			const sub: JSONSchema7 = {
				type: "object",
				properties: {
					config: {
						type: "object",
					},
				},
			};
			const sup: JSONSchema7 = {
				type: "object",
				properties: {
					config: {
						type: "object",
						propertyNames: { pattern: "^[a-z_]+$" },
					},
				},
			};
			expect(checker.isSubset(sub, sup)).toBe(false);
		});

		test("diff on nested propertyNames includes correct path", () => {
			const sub: JSONSchema7 = {
				type: "object",
				properties: {
					config: {
						type: "object",
					},
				},
			};
			const sup: JSONSchema7 = {
				type: "object",
				properties: {
					config: {
						type: "object",
						propertyNames: { minLength: 2 },
					},
				},
			};
			const result = checker.check(sub, sup);
			expect(result.isSubset).toBe(false);
			const diff = result.diffs.find(
				(d) => d.path.includes("config") && d.path.includes("propertyNames"),
			);
			expect(diff).toBeDefined();
		});
	});

	// ── Condition resolver with propertyNames ──────────────────────────────

	describe("condition resolver with propertyNames", () => {
		test("then-branch adds propertyNames to resolved schema", () => {
			const schema: JSONSchema7 = {
				type: "object",
				properties: {
					mode: { type: "string" },
				},
				required: ["mode"],
				if: {
					properties: { mode: { const: "strict" } },
					required: ["mode"],
				},
				then: {
					propertyNames: { pattern: "^[a-z_]+$" },
				},
			};
			const { resolved } = checker.resolveConditions(schema, {
				mode: "strict",
			});
			expect(resolved.propertyNames).toBeDefined();
			expect((resolved.propertyNames as JSONSchema7).pattern).toBe("^[a-z_]+$");
		});

		test("else-branch does not add propertyNames when condition matches then", () => {
			const schema: JSONSchema7 = {
				type: "object",
				properties: {
					mode: { type: "string" },
				},
				required: ["mode"],
				if: {
					properties: { mode: { const: "strict" } },
					required: ["mode"],
				},
				then: {
					propertyNames: { pattern: "^[a-z_]+$" },
				},
				else: {
					propertyNames: { minLength: 1 },
				},
			};
			const { resolved } = checker.resolveConditions(schema, {
				mode: "strict",
			});
			expect((resolved.propertyNames as JSONSchema7).pattern).toBe("^[a-z_]+$");
		});

		test("else-branch adds propertyNames when condition does not match", () => {
			const schema: JSONSchema7 = {
				type: "object",
				properties: {
					mode: { type: "string" },
				},
				required: ["mode"],
				if: {
					properties: { mode: { const: "strict" } },
					required: ["mode"],
				},
				then: {
					propertyNames: { pattern: "^[a-z_]+$" },
				},
				else: {
					propertyNames: { minLength: 1 },
				},
			};
			const { resolved } = checker.resolveConditions(schema, {
				mode: "relaxed",
			});
			expect((resolved.propertyNames as JSONSchema7).minLength).toBe(1);
		});
	});
});
