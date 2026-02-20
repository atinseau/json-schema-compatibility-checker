import { beforeAll, describe, expect, test } from "bun:test";
import type { JSONSchema7, JSONSchema7Definition } from "json-schema";
import { JsonSchemaCompatibilityChecker } from "../../src";

/** JSONSchema7 with dependencies keyword (typed more broadly for test access) */
interface JSONSchema7WithDeps extends JSONSchema7 {
	dependencies?: Record<string, JSONSchema7Definition | string[]>;
}

let checker: JsonSchemaCompatibilityChecker;

beforeAll(() => {
	checker = new JsonSchemaCompatibilityChecker();
});

// ═══════════════════════════════════════════════════════════════════════════════
//  dependencies — normalize, subset, resolveConditions, advanced behavior
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
//  Point 3 — dependencies support
// ─────────────────────────────────────────────────────────────────────────────

describe("Point 3 — dependencies", () => {
	// ── normalize ──

	test('normalize dependencies schema form: { const: "bar" } gets type inferred', () => {
		const schema: JSONSchema7WithDeps = {
			dependencies: { foo: { const: "bar" } },
		};
		const result = checker.normalize(schema) as JSONSchema7WithDeps;
		expect((result.dependencies?.foo as JSONSchema7).type).toBe("string");
	});

	test("normalize dependencies array form: passes through unchanged", () => {
		const schema: JSONSchema7WithDeps = {
			dependencies: { foo: ["bar"] },
		};
		const result = checker.normalize(schema) as JSONSchema7WithDeps;
		expect(result.dependencies?.foo).toEqual(["bar"]);
	});

	// ── isSubset ──

	test("schema with dependencies ⊆ schema without dependencies (more constrained)", () => {
		const sub: JSONSchema7WithDeps = {
			type: "object",
			properties: { a: { type: "string" }, b: { type: "string" } },
			dependencies: { a: ["b"] },
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: { a: { type: "string" }, b: { type: "string" } },
		};
		expect(checker.isSubset(sub, sup)).toBe(true);
	});

	// ── resolveConditions with dependencies in then ──

	test("then-branch adding dependencies merges into resolved", () => {
		const schema: JSONSchema7 = {
			type: "object",
			properties: {
				mode: { type: "string" },
				a: { type: "string" },
				b: { type: "string" },
			},
			required: ["mode"],
			if: {
				properties: { mode: { const: "strict" } },
				required: ["mode"],
			},
			then: {
				dependencies: { a: ["b"] },
			} as JSONSchema7WithDeps,
		};
		const { resolved } = checker.resolveConditions(schema, { mode: "strict" });
		const resolvedWithDeps = resolved as JSONSchema7WithDeps;
		expect(resolvedWithDeps.dependencies).toBeDefined();
		expect(resolvedWithDeps.dependencies?.a).toEqual(["b"]);
	});
});

describe("dependencies — advanced behavior", () => {
	test("property dependencies (array form) — subset check", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				credit_card: { type: "string" },
				billing_address: { type: "string" },
				shipping_address: { type: "string" },
			},
			dependencies: {
				credit_card: ["billing_address", "shipping_address"],
			},
		};

		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				credit_card: { type: "string" },
				billing_address: { type: "string" },
				shipping_address: { type: "string" },
			},
			dependencies: {
				credit_card: ["billing_address"],
			},
		};

		// sub requires BOTH billing + shipping when credit_card is present
		// sup requires ONLY billing when credit_card is present
		// sub is MORE constrained → sub ⊆ sup
		expect(checker.isSubset(sub, sup)).toBe(true);
	});

	test("schema dependencies — subset check", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				mode: { type: "string" },
				debug: { type: "boolean" },
			},
			dependencies: {
				mode: {
					required: ["debug"],
					properties: { debug: { type: "boolean" } },
				},
			},
		};

		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				mode: { type: "string" },
				debug: { type: "boolean" },
			},
		};

		// sub has extra dependency constraint → more constrained
		expect(checker.isSubset(sub, sup)).toBe(true);
	});

	test("intersect of array dependencies — union", () => {
		const result = checker.intersect(
			{
				type: "object",
				dependencies: { a: ["b"] },
			},
			{
				type: "object",
				dependencies: { a: ["c"] },
			},
		);

		expect(result).not.toBeNull();
		if (result && typeof result !== "boolean") {
			const deps = (result as JSONSchema7).dependencies;
			if (deps?.a && Array.isArray(deps.a)) {
				expect(deps.a).toContain("b");
				expect(deps.a).toContain("c");
			}
		}
	});
});
