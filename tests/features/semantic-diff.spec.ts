import { beforeAll, describe, expect, test } from "bun:test";
import type { JSONSchema7 } from "json-schema";
import {
	formatSemanticDiffs,
	JsonSchemaCompatibilityChecker,
	type SemanticDiff,
	type SemanticDiffType,
} from "../../src";
import { computeSemanticDiffs } from "../../src/semantic-diff";

let checker: JsonSchemaCompatibilityChecker;

beforeAll(() => {
	checker = new JsonSchemaCompatibilityChecker();
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Shortcut: run canConnect and return semantic diffs */
function getSemanticDiffs(
	source: JSONSchema7,
	target: JSONSchema7,
): SemanticDiff[] {
	return checker.canConnect(source, target).semanticDiffs;
}

/** Find first semantic diff of a given type */
function findDiff(
	diffs: SemanticDiff[],
	type: SemanticDiffType,
): SemanticDiff | undefined {
	return diffs.find((d) => d.type === type);
}

/** Find all semantic diffs of a given type */
function findAllDiffs(
	diffs: SemanticDiff[],
	type: SemanticDiffType,
): SemanticDiff[] {
	return diffs.filter((d) => d.type === type);
}

// ═════════════════════════════════════════════════════════════════════════════
//  1. missing-required-property
// ═════════════════════════════════════════════════════════════════════════════

describe("missing-required-property", () => {
	test("detects a single missing required property", () => {
		const diffs = getSemanticDiffs(
			{
				type: "object",
				properties: { accountId: { type: "string" } },
				required: ["accountId"],
			},
			{
				type: "object",
				properties: { meetingId: { type: "string" } },
				required: ["meetingId"],
			},
		);

		const diff = findDiff(diffs, "missing-required-property");
		expect(diff).toBeDefined();
		expect(diff?.path).toBe("properties.meetingId");
		expect(diff?.message).toContain("meetingId");
		expect(diff?.message).toContain("source does not provide");
		expect(diff?.details.property).toBe("meetingId");
		expect(diff?.details.targetSchema).toEqual({ type: "string" });
	});

	test("detects multiple missing required properties", () => {
		const diffs = getSemanticDiffs(
			{
				type: "object",
				properties: { a: { type: "string" } },
				required: ["a"],
			},
			{
				type: "object",
				properties: {
					b: { type: "string" },
					c: { type: "number" },
				},
				required: ["b", "c"],
			},
		);

		const missing = findAllDiffs(diffs, "missing-required-property");
		expect(missing.length).toBe(2);
		const names = missing.map((d) => d.details.property);
		expect(names).toContain("b");
		expect(names).toContain("c");
	});

	test("groups structural 'properties.X added' + 'required changed' into one semantic diff", () => {
		const result = checker.canConnect(
			{
				type: "object",
				properties: { accountId: { type: "string" } },
				required: ["accountId"],
			},
			{
				type: "object",
				properties: { meetingId: { type: "string" } },
				required: ["meetingId"],
			},
		);

		// Structural diffs should have 2 entries (properties.meetingId added + required changed)
		expect(result.diffs.length).toBe(2);
		// Semantic diffs should have only 1 entry
		const missing = findAllDiffs(
			result.semanticDiffs,
			"missing-required-property",
		);
		expect(missing.length).toBe(1);
	});

	test("includes target schema type in message", () => {
		const diffs = getSemanticDiffs(
			{ type: "object", properties: {}, required: [] },
			{
				type: "object",
				properties: { count: { type: "number" } },
				required: ["count"],
			},
		);

		const diff = findDiff(diffs, "missing-required-property");
		expect(diff).toBeDefined();
		expect(diff?.message).toContain("number");
	});

	test("does not fire when source has the required property", () => {
		const diffs = getSemanticDiffs(
			{
				type: "object",
				properties: { id: { type: "string" } },
				required: ["id"],
			},
			{
				type: "object",
				properties: { id: { type: "string" } },
				required: ["id"],
			},
		);

		expect(findDiff(diffs, "missing-required-property")).toBeUndefined();
		expect(diffs).toEqual([]);
	});
});

// ═════════════════════════════════════════════════════════════════════════════
//  2. property-not-guaranteed
// ═════════════════════════════════════════════════════════════════════════════

describe("property-not-guaranteed", () => {
	test("detects optional in source but required in target", () => {
		const diffs = getSemanticDiffs(
			{
				type: "object",
				properties: {
					name: { type: "string" },
					email: { type: "string" },
				},
				required: ["name"],
			},
			{
				type: "object",
				properties: {
					name: { type: "string" },
					email: { type: "string" },
				},
				required: ["name", "email"],
			},
		);

		const diff = findDiff(diffs, "property-not-guaranteed");
		expect(diff).toBeDefined();
		expect(diff?.path).toBe("properties.email");
		expect(diff?.message).toContain("email");
		expect(diff?.message).toContain("optional in source");
		expect(diff?.message).toContain("required by target");
		expect(diff?.details.property).toBe("email");
	});

	test("detects multiple properties not guaranteed", () => {
		const diffs = getSemanticDiffs(
			{
				type: "object",
				properties: {
					a: { type: "string" },
					b: { type: "string" },
					c: { type: "string" },
				},
				required: ["a"],
			},
			{
				type: "object",
				properties: {
					a: { type: "string" },
					b: { type: "string" },
					c: { type: "string" },
				},
				required: ["a", "b", "c"],
			},
		);

		const notGuaranteed = findAllDiffs(diffs, "property-not-guaranteed");
		expect(notGuaranteed.length).toBe(2);
		const names = notGuaranteed.map((d) => d.details.property);
		expect(names).toContain("b");
		expect(names).toContain("c");
	});

	test("does not fire when property is required in both", () => {
		const diffs = getSemanticDiffs(
			{
				type: "object",
				properties: { name: { type: "string" } },
				required: ["name"],
			},
			{
				type: "object",
				properties: { name: { type: "string" } },
				required: ["name"],
			},
		);

		expect(findDiff(diffs, "property-not-guaranteed")).toBeUndefined();
	});

	test("does not fire for missing-required (property absent from source)", () => {
		const diffs = getSemanticDiffs(
			{
				type: "object",
				properties: { a: { type: "string" } },
				required: ["a"],
			},
			{
				type: "object",
				properties: { b: { type: "string" } },
				required: ["b"],
			},
		);

		// Should be missing-required-property, NOT property-not-guaranteed
		expect(findDiff(diffs, "property-not-guaranteed")).toBeUndefined();
		expect(findDiff(diffs, "missing-required-property")).toBeDefined();
	});
});

// ═════════════════════════════════════════════════════════════════════════════
//  3. type-mismatch
// ═════════════════════════════════════════════════════════════════════════════

describe("type-mismatch", () => {
	test("detects incompatible property types", () => {
		const result = checker.check(
			{
				type: "object",
				properties: { val: { type: "string" } },
				required: ["val"],
			},
			{
				type: "object",
				properties: { val: { type: "number" } },
				required: ["val"],
			},
		);

		// Type conflicts on properties cause merge failures,
		// so we expect either type-mismatch or schema-incompatible
		expect(result.isSubset).toBe(false);
		expect(result.semanticDiffs.length).toBeGreaterThan(0);
	});
});

// ═════════════════════════════════════════════════════════════════════════════
//  4. type-too-wide
// ═════════════════════════════════════════════════════════════════════════════

describe("type-too-wide", () => {
	test("detects source type union wider than target", () => {
		const diffs = getSemanticDiffs(
			{ type: ["string", "number"] },
			{ type: "string" },
		);

		const diff = findDiff(diffs, "type-too-wide");
		expect(diff).toBeDefined();
		expect(diff?.message).toContain("string | number");
		expect(diff?.message).toContain("only accepts");
		expect(diff?.details.sourceType).toEqual(["string", "number"]);
		expect(diff?.details.targetType).toBe("string");
	});

	test("does not fire when types are identical", () => {
		const diffs = getSemanticDiffs({ type: "string" }, { type: "string" });

		expect(findDiff(diffs, "type-too-wide")).toBeUndefined();
	});

	test("does not fire when source is narrower than target", () => {
		const diffs = getSemanticDiffs(
			{ type: "string" },
			{ type: ["string", "number"] },
		);

		expect(findDiff(diffs, "type-too-wide")).toBeUndefined();
		expect(diffs).toEqual([]);
	});
});

// ═════════════════════════════════════════════════════════════════════════════
//  5. enum-not-subset
// ═════════════════════════════════════════════════════════════════════════════

describe("enum-not-subset", () => {
	test("detects source enum values not in target", () => {
		const diffs = getSemanticDiffs(
			{ type: "string", enum: ["active", "inactive", "deleted"] },
			{ type: "string", enum: ["active", "inactive"] },
		);

		const diff = findDiff(diffs, "enum-not-subset");
		expect(diff).toBeDefined();
		expect(diff?.message).toContain("deleted");
		expect(diff?.message).toContain("does not accept");
		expect(diff?.details.extraValues).toEqual(["deleted"]);
	});

	test("does not fire when source enum is a subset", () => {
		const diffs = getSemanticDiffs(
			{ type: "string", enum: ["a", "b"] },
			{ type: "string", enum: ["a", "b", "c"] },
		);

		expect(findDiff(diffs, "enum-not-subset")).toBeUndefined();
		expect(diffs).toEqual([]);
	});

	test("detects multiple extra values", () => {
		const diffs = getSemanticDiffs(
			{ type: "string", enum: ["a", "b", "c", "d"] },
			{ type: "string", enum: ["a", "b"] },
		);

		const diff = findDiff(diffs, "enum-not-subset");
		expect(diff).toBeDefined();
		expect((diff?.details.extraValues as unknown[]).length).toBe(2);
	});

	test("detects enum mismatch on a property", () => {
		const diffs = getSemanticDiffs(
			{
				type: "object",
				properties: {
					status: { type: "string", enum: ["open", "closed", "archived"] },
				},
				required: ["status"],
			},
			{
				type: "object",
				properties: {
					status: { type: "string", enum: ["open", "closed"] },
				},
				required: ["status"],
			},
		);

		const diff = findDiff(diffs, "enum-not-subset");
		expect(diff).toBeDefined();
		expect(diff?.path).toBe("properties.status");
		expect(diff?.details.property).toBe("status");
	});
});

// ═════════════════════════════════════════════════════════════════════════════
//  6. const-mismatch
// ═════════════════════════════════════════════════════════════════════════════

describe("const-mismatch", () => {
	test("detects different const values on a property", () => {
		const _diffs = getSemanticDiffs(
			{
				type: "object",
				properties: { role: { type: "string", const: "user" } },
				required: ["role"],
			},
			{
				type: "object",
				properties: { role: { type: "string", const: "admin" } },
				required: ["role"],
			},
		);

		// const mismatch causes a merge failure, so might be schema-incompatible
		const result = checker.check(
			{
				type: "object",
				properties: { role: { type: "string", const: "user" } },
				required: ["role"],
			},
			{
				type: "object",
				properties: { role: { type: "string", const: "admin" } },
				required: ["role"],
			},
		);
		expect(result.isSubset).toBe(false);
		expect(result.semanticDiffs.length).toBeGreaterThan(0);
	});
});

// ═════════════════════════════════════════════════════════════════════════════
//  7. constraint-too-loose
// ═════════════════════════════════════════════════════════════════════════════

describe("constraint-too-loose", () => {
	test("detects minimum value too loose", () => {
		const diffs = getSemanticDiffs(
			{ type: "number", minimum: 0 },
			{ type: "number", minimum: 5 },
		);

		const diff = findDiff(diffs, "constraint-too-loose");
		expect(diff).toBeDefined();
		expect(diff?.details.constraint).toBe("minimum");
		expect(diff?.details.sourceValue).toBe(0);
		expect(diff?.details.targetValue).toBe(5);
		expect(diff?.message).toContain("minimum");
	});

	test("detects maximum value too loose", () => {
		const diffs = getSemanticDiffs(
			{ type: "number", maximum: 100 },
			{ type: "number", maximum: 10 },
		);

		const diff = findDiff(diffs, "constraint-too-loose");
		expect(diff).toBeDefined();
		expect(diff?.details.constraint).toBe("maximum");
		expect(diff?.details.sourceValue).toBe(100);
		expect(diff?.details.targetValue).toBe(10);
	});

	test("detects both minimum and maximum too loose", () => {
		const diffs = getSemanticDiffs(
			{ type: "number", minimum: 0, maximum: 100 },
			{ type: "number", minimum: 5, maximum: 10 },
		);

		const constraints = findAllDiffs(diffs, "constraint-too-loose");
		expect(constraints.length).toBe(2);
		const names = constraints.map((d) => d.details.constraint);
		expect(names).toContain("minimum");
		expect(names).toContain("maximum");
	});

	test("detects minLength too loose", () => {
		const diffs = getSemanticDiffs(
			{ type: "string", minLength: 1 },
			{ type: "string", minLength: 5 },
		);

		const diff = findDiff(diffs, "constraint-too-loose");
		expect(diff).toBeDefined();
		expect(diff?.details.constraint).toBe("minLength");
		expect(diff?.details.sourceValue).toBe(1);
		expect(diff?.details.targetValue).toBe(5);
	});

	test("detects maxLength too loose", () => {
		const diffs = getSemanticDiffs(
			{ type: "string", maxLength: 255 },
			{ type: "string", maxLength: 100 },
		);

		const diff = findDiff(diffs, "constraint-too-loose");
		expect(diff).toBeDefined();
		expect(diff?.details.constraint).toBe("maxLength");
	});

	test("detects constraint added (source has none)", () => {
		const diffs = getSemanticDiffs(
			{ type: "number" },
			{ type: "number", minimum: 5 },
		);

		const diff = findDiff(diffs, "constraint-too-loose");
		expect(diff).toBeDefined();
		expect(diff?.details.constraint).toBe("minimum");
		expect(diff?.details.sourceValue).toBeNull();
		expect(diff?.details.targetValue).toBe(5);
	});

	test("detects minItems too loose", () => {
		const diffs = getSemanticDiffs(
			{ type: "array", items: { type: "string" }, minItems: 1 },
			{ type: "array", items: { type: "string" }, minItems: 3 },
		);

		const diff = findDiff(diffs, "constraint-too-loose");
		expect(diff).toBeDefined();
		expect(diff?.details.constraint).toBe("minItems");
	});

	test("detects constraint on a property", () => {
		const diffs = getSemanticDiffs(
			{
				type: "object",
				properties: { age: { type: "number", minimum: 0 } },
				required: ["age"],
			},
			{
				type: "object",
				properties: { age: { type: "number", minimum: 18 } },
				required: ["age"],
			},
		);

		const diff = findDiff(diffs, "constraint-too-loose");
		expect(diff).toBeDefined();
		expect(diff?.path).toBe("properties.age");
		expect(diff?.details.property).toBe("age");
		expect(diff?.details.constraint).toBe("minimum");
	});

	test("does not fire when source is tighter", () => {
		const diffs = getSemanticDiffs(
			{ type: "number", minimum: 10 },
			{ type: "number", minimum: 5 },
		);

		expect(findDiff(diffs, "constraint-too-loose")).toBeUndefined();
		expect(diffs).toEqual([]);
	});
});

// ═════════════════════════════════════════════════════════════════════════════
//  8. additional-properties-conflict
// ═════════════════════════════════════════════════════════════════════════════

describe("additional-properties-conflict", () => {
	test("detects source allows additional but target forbids", () => {
		const _diffs = getSemanticDiffs(
			{
				type: "object",
				properties: {
					name: { type: "string" },
					extra: { type: "string" },
				},
				required: ["name"],
			},
			{
				type: "object",
				properties: { name: { type: "string" } },
				required: ["name"],
				additionalProperties: false,
			},
		);

		// Should have some diagnostic about additionalProperties or property-not-allowed
		const result = checker.check(
			{
				type: "object",
				properties: {
					name: { type: "string" },
					extra: { type: "string" },
				},
				required: ["name"],
			},
			{
				type: "object",
				properties: { name: { type: "string" } },
				required: ["name"],
				additionalProperties: false,
			},
		);
		expect(result.isSubset).toBe(false);
		expect(result.semanticDiffs.length).toBeGreaterThan(0);
	});
});

// ═════════════════════════════════════════════════════════════════════════════
//  9. property-not-allowed
// ═════════════════════════════════════════════════════════════════════════════

describe("property-not-allowed", () => {
	test("detects source property not allowed by target (additionalProperties: false)", () => {
		const diffs = getSemanticDiffs(
			{
				type: "object",
				properties: {
					name: { type: "string" },
					age: { type: "number" },
				},
				required: ["name"],
			},
			{
				type: "object",
				properties: { name: { type: "string" } },
				required: ["name"],
				additionalProperties: false,
			},
		);

		const diff = findDiff(diffs, "property-not-allowed");
		expect(diff).toBeDefined();
		expect(diff?.path).toBe("properties.age");
		expect(diff?.details.property).toBe("age");
		expect(diff?.message).toContain("age");
		expect(diff?.message).toContain("does not allow");
	});

	test("detects multiple properties not allowed", () => {
		const diffs = getSemanticDiffs(
			{
				type: "object",
				properties: {
					name: { type: "string" },
					age: { type: "number" },
					bio: { type: "string" },
				},
				required: ["name"],
			},
			{
				type: "object",
				properties: { name: { type: "string" } },
				required: ["name"],
				additionalProperties: false,
			},
		);

		const notAllowed = findAllDiffs(diffs, "property-not-allowed");
		expect(notAllowed.length).toBe(2);
		const names = notAllowed.map((d) => d.details.property);
		expect(names).toContain("age");
		expect(names).toContain("bio");
	});
});

// ═════════════════════════════════════════════════════════════════════════════
//  10. format-mismatch
// ═════════════════════════════════════════════════════════════════════════════

describe("format-mismatch", () => {
	test("detects format added by target", () => {
		const diffs = getSemanticDiffs(
			{ type: "string" },
			{ type: "string", format: "email" },
		);

		const diff = findDiff(diffs, "format-mismatch");
		expect(diff).toBeDefined();
		expect(diff?.details.sourceFormat).toBeNull();
		expect(diff?.details.targetFormat).toBe("email");
		expect(diff?.message).toContain("email");
	});

	test("detects format mismatch on a property", () => {
		const diffs = getSemanticDiffs(
			{
				type: "object",
				properties: { email: { type: "string" } },
				required: ["email"],
			},
			{
				type: "object",
				properties: { email: { type: "string", format: "email" } },
				required: ["email"],
			},
		);

		const diff = findDiff(diffs, "format-mismatch");
		expect(diff).toBeDefined();
		expect(diff?.path).toBe("properties.email");
		expect(diff?.details.property).toBe("email");
	});
});

// ═════════════════════════════════════════════════════════════════════════════
//  11. pattern-not-subset
// ═════════════════════════════════════════════════════════════════════════════

describe("pattern-not-subset", () => {
	test("detects pattern added by target", () => {
		const diffs = getSemanticDiffs(
			{ type: "string", minLength: 1 },
			{ type: "string", minLength: 1, pattern: "^[a-z]+$" },
		);

		const diff = findDiff(diffs, "pattern-not-subset");
		expect(diff).toBeDefined();
		expect(diff?.details.sourcePattern).toBeNull();
		expect(diff?.details.targetPattern).toBe("^[a-z]+$");
		expect(diff?.message).toContain("pattern");
	});
});

// ═════════════════════════════════════════════════════════════════════════════
//  12. incompatible-items
// ═════════════════════════════════════════════════════════════════════════════

describe("incompatible-items", () => {
	test("detects items schema type difference", () => {
		const diffs = getSemanticDiffs(
			{ type: "array", items: { type: ["string", "number"] } },
			{ type: "array", items: { type: "string" } },
		);

		// Should detect an incompatibility in items
		expect(diffs.length).toBeGreaterThan(0);
		// Could be incompatible-items or type-too-wide depending on path resolution
		const hasItemsDiff = diffs.some(
			(d) => d.type === "incompatible-items" || d.path.startsWith("items"),
		);
		expect(hasItemsDiff).toBe(true);
	});
});

// ═════════════════════════════════════════════════════════════════════════════
//  13. schema-incompatible (fallback)
// ═════════════════════════════════════════════════════════════════════════════

describe("schema-incompatible (fallback)", () => {
	test("produces fallback for completely incompatible types", () => {
		const result = checker.check({ type: "string" }, { type: "number" });

		expect(result.isSubset).toBe(false);
		const diff = findDiff(result.semanticDiffs, "schema-incompatible");
		expect(diff).toBeDefined();
		expect(diff?.path).toBe("$");
		expect(diff?.message).toContain("Incompatible");
	});

	test("produces fallback for boolean schema conflicts", () => {
		const result = checker.check(true, false);

		expect(result.isSubset).toBe(false);
		const diff = findDiff(result.semanticDiffs, "schema-incompatible");
		expect(diff).toBeDefined();
		expect(diff?.message).toContain("rejects all values");
	});
});

// ═════════════════════════════════════════════════════════════════════════════
//  Analyzer pipeline
// ═════════════════════════════════════════════════════════════════════════════

describe("analyzer pipeline", () => {
	test("returns empty array when schemas are compatible", () => {
		const result = checker.check(
			{ type: "string", minLength: 5 },
			{ type: "string" },
		);

		expect(result.isSubset).toBe(true);
		expect(result.semanticDiffs).toEqual([]);
	});

	test("returns empty array for identity check", () => {
		const schema: JSONSchema7 = {
			type: "object",
			properties: { id: { type: "string" } },
			required: ["id"],
		};
		const result = checker.check(schema, schema);

		expect(result.isSubset).toBe(true);
		expect(result.semanticDiffs).toEqual([]);
	});

	test("never silently drops structural diffs — all become semantic", () => {
		const result = checker.check(
			{
				type: "object",
				properties: {
					name: { type: "string" },
					age: { type: "number", minimum: 0 },
				},
				required: ["name"],
			},
			{
				type: "object",
				properties: {
					name: { type: "string" },
					age: { type: "number", minimum: 18 },
				},
				required: ["name", "age"],
			},
		);

		expect(result.isSubset).toBe(false);
		// Every structural diff should produce at least one semantic diff
		expect(result.semanticDiffs.length).toBeGreaterThan(0);
		// Should have property-not-guaranteed for age + constraint-too-loose for minimum
		expect(
			findDiff(result.semanticDiffs, "property-not-guaranteed"),
		).toBeDefined();
		expect(
			findDiff(result.semanticDiffs, "constraint-too-loose"),
		).toBeDefined();
	});

	test("consumed diffs are not duplicated in fallback", () => {
		const result = checker.canConnect(
			{
				type: "object",
				properties: { accountId: { type: "string" } },
				required: ["accountId"],
			},
			{
				type: "object",
				properties: { meetingId: { type: "string" } },
				required: ["meetingId"],
			},
		);

		// Should produce exactly 1 semantic diff, not 2 (no fallback for consumed required diff)
		expect(result.semanticDiffs.length).toBe(1);
		expect(result.semanticDiffs[0]?.type).toBe("missing-required-property");
	});

	test("priority: missing-required-property before property-not-guaranteed", () => {
		const diffs = getSemanticDiffs(
			{
				type: "object",
				properties: {
					a: { type: "string" },
					b: { type: "string" },
				},
				required: ["a"],
			},
			{
				type: "object",
				properties: {
					a: { type: "string" },
					b: { type: "string" },
					c: { type: "number" },
				},
				required: ["a", "b", "c"],
			},
		);

		// b is optional in source → property-not-guaranteed
		// c is missing from source → missing-required-property
		const missingDiff = findDiff(diffs, "missing-required-property");
		const notGuaranteedDiff = findDiff(diffs, "property-not-guaranteed");
		expect(missingDiff).toBeDefined();
		expect(missingDiff?.details.property).toBe("c");
		expect(notGuaranteedDiff).toBeDefined();
		expect(notGuaranteedDiff?.details.property).toBe("b");
		// missing-required should come first (pipeline order)
		const missingIdx = diffs.findIndex(
			(d) => d.type === "missing-required-property",
		);
		const notGuaranteedIdx = diffs.findIndex(
			(d) => d.type === "property-not-guaranteed",
		);
		expect(missingIdx).toBeLessThan(notGuaranteedIdx);
	});

	test("handles empty diffs input", () => {
		const result = computeSemanticDiffs(
			{ type: "string" },
			{ type: "string" },
			[],
		);
		expect(result).toEqual([]);
	});
});

// ═════════════════════════════════════════════════════════════════════════════
//  canConnect integration
// ═════════════════════════════════════════════════════════════════════════════

describe("canConnect — semantic diffs integration", () => {
	test("semanticDiffs are present in ConnectionResult", () => {
		const result = checker.canConnect(
			{
				type: "object",
				properties: { accountId: { type: "string" } },
				required: ["accountId"],
			},
			{
				type: "object",
				properties: { meetingId: { type: "string" } },
				required: ["meetingId"],
			},
		);

		expect(result.semanticDiffs).toBeDefined();
		expect(Array.isArray(result.semanticDiffs)).toBe(true);
		expect(result.semanticDiffs.length).toBeGreaterThan(0);
		expect(result.direction).toBe("sourceOutput ⊆ targetInput");
	});

	test("compatible connection has empty semanticDiffs", () => {
		const result = checker.canConnect(
			{
				type: "object",
				properties: {
					id: { type: "string" },
					name: { type: "string" },
				},
				required: ["id", "name"],
			},
			{
				type: "object",
				properties: { id: { type: "string" } },
				required: ["id"],
			},
		);

		expect(result.isSubset).toBe(true);
		expect(result.semanticDiffs).toEqual([]);
	});

	test("complex real-world node connection", () => {
		const nodeAOutput: JSONSchema7 = {
			type: "object",
			properties: {
				order: {
					type: "object",
					properties: {
						id: { type: "string" },
						total: { type: "number", minimum: 0 },
					},
					required: ["id", "total"],
				},
			},
			required: ["order"],
		};

		const nodeBInput: JSONSchema7 = {
			type: "object",
			properties: {
				order: {
					type: "object",
					properties: {
						id: { type: "string" },
						total: { type: "number", minimum: 0 },
						currency: { type: "string" },
					},
					required: ["id", "total", "currency"],
				},
			},
			required: ["order"],
		};

		const result = checker.canConnect(nodeAOutput, nodeBInput);

		expect(result.isSubset).toBe(false);
		expect(result.semanticDiffs.length).toBeGreaterThan(0);
		// The missing property 'currency' should be detected somewhere in the diffs
		const hasCurrencyDiff = result.semanticDiffs.some(
			(d) => d.message.includes("currency") || d.path.includes("currency"),
		);
		expect(hasCurrencyDiff).toBe(true);
	});
});

// ═════════════════════════════════════════════════════════════════════════════
//  Formatter integration
// ═════════════════════════════════════════════════════════════════════════════

describe("formatter — semantic diffs", () => {
	test("formatResult prefers semantic diffs over structural", () => {
		const result = checker.canConnect(
			{
				type: "object",
				properties: { accountId: { type: "string" } },
				required: ["accountId"],
			},
			{
				type: "object",
				properties: { meetingId: { type: "string" } },
				required: ["meetingId"],
			},
		);
		const formatted = checker.formatResult("test", result);

		// Should contain the semantic message, not the structural "required changed"
		expect(formatted).toContain("missing-required-property");
		expect(formatted).toContain("meetingId");
		expect(formatted).not.toContain("→"); // no structural arrow
	});

	test("formatResult shows icon for semantic diff type", () => {
		const result = checker.canConnect(
			{
				type: "object",
				properties: { accountId: { type: "string" } },
				required: ["accountId"],
			},
			{
				type: "object",
				properties: { meetingId: { type: "string" } },
				required: ["meetingId"],
			},
		);
		const formatted = checker.formatResult("test", result);

		expect(formatted).toContain("🔴");
		expect(formatted).toContain("❌");
	});

	test("formatSemanticDiffs standalone function", () => {
		const result = checker.canConnect(
			{ type: "number", minimum: 0 },
			{ type: "number", minimum: 5 },
		);

		const formatted = formatSemanticDiffs(result.semanticDiffs);
		expect(formatted).toContain("constraint-too-loose");
		expect(formatted).toContain("minimum");
	});

	test("formatSemanticDiffs returns empty string for no diffs", () => {
		expect(formatSemanticDiffs([])).toBe("");
	});

	test("formatResult uses structural diffs as fallback when no semantic diffs", () => {
		// Manually construct a result with no semantic diffs but with structural diffs
		const formatted = checker.formatResult("test", {
			isSubset: false,
			merged: null,
			diffs: [
				{
					path: "type",
					type: "changed",
					sourceValue: "string",
					mergedValue: "number",
				},
			],
			semanticDiffs: [],
		});

		// Should fall back to structural formatting
		expect(formatted).toContain("structural");
		expect(formatted).toContain("~");
		expect(formatted).toContain("→");
	});
});

// ═════════════════════════════════════════════════════════════════════════════
//  Semantic diff details structure
// ═════════════════════════════════════════════════════════════════════════════

describe("semantic diff details structure", () => {
	test("missing-required-property has property and targetSchema", () => {
		const diffs = getSemanticDiffs(
			{ type: "object", properties: {}, required: [] },
			{
				type: "object",
				properties: { id: { type: "string" } },
				required: ["id"],
			},
		);

		const diff = findDiff(diffs, "missing-required-property");
		expect(diff).toBeDefined();
		expect(diff?.details).toHaveProperty("property");
		expect(diff?.details).toHaveProperty("targetSchema");
		expect(typeof diff?.details.property).toBe("string");
	});

	test("constraint-too-loose has constraint, sourceValue, targetValue", () => {
		const diffs = getSemanticDiffs(
			{ type: "number", minimum: 0 },
			{ type: "number", minimum: 10 },
		);

		const diff = findDiff(diffs, "constraint-too-loose");
		expect(diff).toBeDefined();
		expect(diff?.details).toHaveProperty("constraint");
		expect(diff?.details).toHaveProperty("sourceValue");
		expect(diff?.details).toHaveProperty("targetValue");
	});

	test("enum-not-subset has sourceValues, targetValues, extraValues", () => {
		const diffs = getSemanticDiffs(
			{ type: "string", enum: ["a", "b", "c"] },
			{ type: "string", enum: ["a", "b"] },
		);

		const diff = findDiff(diffs, "enum-not-subset");
		expect(diff).toBeDefined();
		expect(diff?.details).toHaveProperty("sourceValues");
		expect(diff?.details).toHaveProperty("targetValues");
		expect(diff?.details).toHaveProperty("extraValues");
		expect(Array.isArray(diff?.details.extraValues)).toBe(true);
	});

	test("type-too-wide has sourceType and targetType", () => {
		const diffs = getSemanticDiffs(
			{ type: ["string", "number"] },
			{ type: "string" },
		);

		const diff = findDiff(diffs, "type-too-wide");
		expect(diff).toBeDefined();
		expect(diff?.details).toHaveProperty("sourceType");
		expect(diff?.details).toHaveProperty("targetType");
	});

	test("format-mismatch has sourceFormat and targetFormat", () => {
		const diffs = getSemanticDiffs(
			{ type: "string" },
			{ type: "string", format: "email" },
		);

		const diff = findDiff(diffs, "format-mismatch");
		expect(diff).toBeDefined();
		expect(diff?.details).toHaveProperty("sourceFormat");
		expect(diff?.details).toHaveProperty("targetFormat");
	});

	test("property-not-allowed has property name", () => {
		const diffs = getSemanticDiffs(
			{
				type: "object",
				properties: {
					name: { type: "string" },
					secret: { type: "string" },
				},
				required: ["name"],
			},
			{
				type: "object",
				properties: { name: { type: "string" } },
				required: ["name"],
				additionalProperties: false,
			},
		);

		const diff = findDiff(diffs, "property-not-allowed");
		expect(diff).toBeDefined();
		expect(diff?.details.property).toBe("secret");
	});

	test("schema-incompatible has reason", () => {
		const result = checker.check({ type: "string" }, { type: "number" });
		const diff = findDiff(result.semanticDiffs, "schema-incompatible");
		expect(diff).toBeDefined();
		expect(diff?.details).toHaveProperty("reason");
	});
});

// ═════════════════════════════════════════════════════════════════════════════
//  Edge cases
// ═════════════════════════════════════════════════════════════════════════════

describe("semantic diff edge cases", () => {
	test("empty schemas are compatible", () => {
		const result = checker.check({}, {});
		expect(result.isSubset).toBe(true);
		expect(result.semanticDiffs).toEqual([]);
	});

	test("boolean true ⊆ boolean true", () => {
		const result = checker.check(true, true);
		expect(result.isSubset).toBe(true);
		expect(result.semanticDiffs).toEqual([]);
	});

	test("boolean false ⊄ boolean true", () => {
		// false schema rejects everything, true accepts everything
		// false ⊆ true is trivially true (empty set ⊆ anything)
		const result = checker.check(false, true);
		expect(result.isSubset).toBe(true);
	});

	test("schema with no overlap produces semantic diffs", () => {
		const result = checker.check(
			{
				type: "object",
				properties: { x: { type: "string" } },
				required: ["x"],
			},
			{
				type: "object",
				properties: { y: { type: "number" } },
				required: ["y"],
			},
		);

		expect(result.isSubset).toBe(false);
		expect(result.semanticDiffs.length).toBeGreaterThan(0);
	});

	test("deeply nested property mismatch still produces diffs", () => {
		const result = checker.check(
			{
				type: "object",
				properties: {
					user: {
						type: "object",
						properties: {
							profile: {
								type: "object",
								properties: { name: { type: "string" } },
								required: ["name"],
							},
						},
						required: ["profile"],
					},
				},
				required: ["user"],
			},
			{
				type: "object",
				properties: {
					user: {
						type: "object",
						properties: {
							profile: {
								type: "object",
								properties: {
									name: { type: "string" },
									bio: { type: "string" },
								},
								required: ["name", "bio"],
							},
						},
						required: ["profile"],
					},
				},
				required: ["user"],
			},
		);

		expect(result.isSubset).toBe(false);
		expect(result.semanticDiffs.length).toBeGreaterThan(0);
	});

	test("anyOf branch rejection produces semantic diffs", () => {
		const result = checker.check(
			{
				anyOf: [{ type: "string" }, { type: "number" }, { type: "boolean" }],
			},
			{
				anyOf: [{ type: "string" }, { type: "number" }],
			},
		);

		expect(result.isSubset).toBe(false);
		expect(result.semanticDiffs.length).toBeGreaterThan(0);
	});

	test("oneOf superset with no match produces semantic diffs", () => {
		const result = checker.check(
			{ type: "boolean" },
			{ oneOf: [{ type: "string" }, { type: "number" }] },
		);

		expect(result.isSubset).toBe(false);
		expect(result.semanticDiffs.length).toBeGreaterThan(0);
	});
});
