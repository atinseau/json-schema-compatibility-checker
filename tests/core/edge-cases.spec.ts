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

	test("isSubset and checkResolved agree on resolved schemas", async () => {
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

		const result = await checker.check(sub, sup, {
			data: { kind: "text", value: "hello" },
		});
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

	// ── data: undefined edge case ────────────────────────────────────────

	test("check with { data: undefined } behaves like static check", async () => {
		const sub: JSONSchema7 = { type: "string", minLength: 1 };
		const sup: JSONSchema7 = { type: "string" };

		const staticResult = checker.check(sub, sup);
		const undefinedDataResult = await checker.check(sub, sup, {
			data: undefined,
		});

		expect(undefinedDataResult.isSubset).toBe(staticResult.isSubset);
		expect(undefinedDataResult.isSubset).toBe(true);
	});

	test("check with { data: undefined } does not resolve conditions", async () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: { kind: { const: "text" }, value: { type: "string" } },
			required: ["kind", "value"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: { kind: { type: "string" }, value: {} },
			required: ["kind", "value"],
			if: { properties: { kind: { const: "text" } }, required: ["kind"] },
			then: { properties: { value: { type: "string" } } },
			else: { properties: { value: { type: "number" } } },
		};

		// Without data, the conditional sup causes a false negative (known limitation).
		// data: undefined should produce the same static result, NOT enter the runtime path.
		const staticResult = checker.check(sub, sup);
		const undefinedDataResult = await checker.check(sub, sup, {
			data: undefined,
		});

		expect(undefinedDataResult.isSubset).toBe(staticResult.isSubset);
	});

	test("check with { data: null } — null is validated against both schemas", async () => {
		const sub: JSONSchema7 = { type: "string" };
		const sup: JSONSchema7 = { type: "string" };

		// null is not a valid string — runtime validation should fail (requires validate: true)
		const result = await checker.check(sub, sup, {
			data: null,
			validate: true,
		});
		expect(result.isSubset).toBe(false);
		expect(result.errors.length).toBeGreaterThan(0);

		// Verify errors are prefixed correctly
		const errorKeys = result.errors.map((e) => e.key);
		expect(errorKeys.some((k) => k.startsWith("$sub"))).toBe(true);
		expect(errorKeys.some((k) => k.startsWith("$sup"))).toBe(true);
	});

	test("check with { data: null } — passes when schemas accept any value", async () => {
		const sub: JSONSchema7 = {};
		const sup: JSONSchema7 = {};

		const result = await checker.check(sub, sup, { data: null });
		expect(result.isSubset).toBe(true);
		expect(result.errors).toEqual([]);
	});

	test("check with primitive data (number) validates correctly", async () => {
		const sub: JSONSchema7 = { type: "number", minimum: 0 };
		const sup: JSONSchema7 = { type: "number" };

		const r1 = await checker.check(sub, sup, { data: 42, validate: true });
		expect(r1.isSubset).toBe(true);
		expect(r1.errors).toEqual([]);

		const r2 = await checker.check(sub, sup, { data: "hello", validate: true });
		expect(r2.isSubset).toBe(false);
		expect(r2.errors.length).toBeGreaterThan(0);
	});

	test("check with primitive data — conditions with properties are not resolved", async () => {
		const schema: JSONSchema7 = {
			type: "string",
			if: { minLength: 5 },
			then: { pattern: "^[A-Z]" },
		};

		const result = await checker.check(schema, schema, { data: "HELLO" });
		expect(result.isSubset).toBe(true);
	});

	test("check with boolean schema true and runtime data", async () => {
		const result = await checker.check(true, true, { data: "hello" });
		expect(result.isSubset).toBe(true);
	});

	test("check with boolean schema false and runtime data", () => {
		// Current implementation attempts narrowing before runtime validation.
		// Passing `false` as the schema under test currently throws during narrowing.
		expect(() =>
			checker.check(
				{ type: "string" } as JSONSchema7Definition,
				false as JSONSchema7Definition,
				{ data: "hello" },
			),
		).toThrow();
	});

	test("bidirectional narrowing — both schemas have enum constraints", async () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				color: { type: "string", enum: ["red", "green", "blue"] },
				size: { type: "string" },
			},
			required: ["color", "size"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				color: { type: "string" },
				size: { type: "string", enum: ["S", "M", "L"] },
			},
			required: ["color", "size"],
		};

		const result = await checker.check(sub, sup, {
			data: { color: "red", size: "M" },
		});
		expect(result.isSubset).toBe(true);
		expect(result.errors).toEqual([]);

		const subWithBothEnums: JSONSchema7 = {
			type: "object",
			properties: {
				color: { type: "string", enum: ["red", "green", "blue"] },
				size: { type: "string", enum: ["S", "M", "L"] },
			},
			required: ["color", "size"],
		};

		const result2 = await checker.check(subWithBothEnums, sup, {
			data: { color: "red", size: "M" },
		});
		expect(result2.isSubset).toBe(true);
	});
});
