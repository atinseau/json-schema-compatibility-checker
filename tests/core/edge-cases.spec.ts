import { beforeAll, describe, expect, test } from "bun:test";
import type { JSONSchema7, JSONSchema7Definition } from "json-schema";
import { JsonSchemaCompatibilityChecker } from "../../src";

let checker: JsonSchemaCompatibilityChecker;

beforeAll(() => {
	checker = new JsonSchemaCompatibilityChecker();
});

// ─────────────────────────────────────────────────────────────────────────────
//  Edge cases & regression tests
// ─────────────────────────────────────────────────────────────────────────────

describe("edge cases", () => {
	test("schema with only description/title (metadata-only) ⊆ empty schema", () => {
		expect(
			checker.isSubset({ title: "A thing", description: "It is a thing" }, {}),
		).toBe(true);
	});

	test("empty schema ⊆ any typed schema (empty allows everything)", () => {
		// empty schema = {} = allows any value
		// typed schema restricts to one type
		// so {} ⊄ {type: "string"}
		expect(checker.isSubset({}, { type: "string" })).toBe(false);
	});

	test("const with same value on both sides is subset", () => {
		expect(checker.isSubset({ const: "same" }, { const: "same" })).toBe(true);
	});

	test("different const values are not subset", () => {
		// Point 1 fix: post-merge const conflict detection now correctly
		// identifies that {const:"one"} ∩ {const:"two"} = ∅ → not a subset.
		expect(checker.isSubset({ const: "one" }, { const: "two" })).toBe(false);
	});

	test("same const values are subset", () => {
		expect(checker.isSubset({ const: "same" }, { const: "same" })).toBe(true);
	});

	test("schema with format constraint: strict format ⊆ no format", () => {
		expect(
			checker.isSubset({ type: "string", format: "email" }, { type: "string" }),
		).toBe(true);
	});

	test("deeply nested 4-level objects", () => {
		const deep: JSONSchema7 = {
			type: "object",
			properties: {
				l1: {
					type: "object",
					properties: {
						l2: {
							type: "object",
							properties: {
								l3: {
									type: "object",
									properties: {
										value: { type: "string", minLength: 1 },
									},
									required: ["value"],
								},
							},
							required: ["l3"],
						},
					},
					required: ["l2"],
				},
			},
			required: ["l1"],
		};
		const shallow: JSONSchema7 = {
			type: "object",
			properties: {
				l1: {
					type: "object",
					properties: {
						l2: {
							type: "object",
							properties: {
								l3: {
									type: "object",
									properties: {
										value: { type: "string" },
									},
									required: ["value"],
								},
							},
							required: ["l3"],
						},
					},
					required: ["l2"],
				},
			},
			required: ["l1"],
		};

		expect(checker.isSubset(deep, shallow)).toBe(true);
		expect(checker.isSubset(shallow, deep)).toBe(false);
	});

	test("combined constraints: object with arrays of typed items", () => {
		const strict: JSONSchema7 = {
			type: "object",
			properties: {
				tags: {
					type: "array",
					items: { type: "string", minLength: 1 },
					minItems: 1,
					maxItems: 10,
				},
			},
			required: ["tags"],
		};
		const loose: JSONSchema7 = {
			type: "object",
			properties: {
				tags: {
					type: "array",
					items: { type: "string" },
				},
			},
			required: ["tags"],
		};

		expect(checker.isSubset(strict, loose)).toBe(true);
		expect(checker.isSubset(loose, strict)).toBe(false);
	});

	test("isSubset and check agree on results", () => {
		const pairs: [JSONSchema7Definition, JSONSchema7Definition][] = [
			[{ type: "string" }, { type: "string" }],
			[{ type: "string" }, { type: "number" }],
			[
				{
					type: "object",
					properties: { a: { type: "string" } },
					required: ["a"],
				},
				{ type: "object", properties: { a: { type: "string" } } },
			],
			[
				{ type: "number", minimum: 5 },
				{ type: "number", minimum: 0 },
			],
			[
				{ anyOf: [{ type: "string" }] },
				{ anyOf: [{ type: "string" }, { type: "number" }] },
			],
			[true, true],
			[false, true],
		];

		for (const [sub, sup] of pairs) {
			const boolResult = checker.isSubset(sub, sup);
			const checkResult = checker.check(sub, sup);
			expect(checkResult.isSubset).toBe(boolResult);
		}
	});

	test("isSubset and checkResolved agree on resolved schemas", () => {
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				kind: { type: "string" },
				value: {},
			},
			required: ["kind", "value"],
			if: { properties: { kind: { const: "text" } }, required: ["kind"] },
			then: { properties: { value: { type: "string" } } },
			else: { properties: { value: { type: "number" } } },
		};
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				kind: { const: "text" },
				value: { type: "string" },
			},
			required: ["kind", "value"],
		};

		const result = checker.checkResolved(sub, sup, { kind: "text" });
		expect(result.isSubset).toBe(
			checker.isSubset(
				result.resolvedSub.resolved,
				result.resolvedSup.resolved,
			),
		);
	});

	test("intersect is commutative for compatible schemas", () => {
		const a: JSONSchema7 = { type: "number", minimum: 0, maximum: 100 };
		const b: JSONSchema7 = { type: "number", minimum: 5, maximum: 50 };

		const ab = checker.intersect(a, b);
		const ba = checker.intersect(b, a);

		expect(ab).not.toBeNull();
		expect(ba).not.toBeNull();
		if (ab && ba) {
			expect(checker.isEqual(ab, ba)).toBe(true);
		}
	});

	test("canConnect result extends SubsetResult with direction field", () => {
		const result = checker.canConnect({ type: "string" }, { type: "string" });

		expect(result).toHaveProperty("isSubset");
		expect(result).toHaveProperty("merged");
		expect(result).toHaveProperty("diffs");
		expect(result).toHaveProperty("direction");
		expect(typeof result.direction).toBe("string");
	});
});
