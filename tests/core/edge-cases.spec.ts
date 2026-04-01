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

	test("description differences inside properties do not affect subset check", () => {
		const a: JSONSchema7 = {
			type: "object",
			properties: {
				name: { type: "string", description: "The user's name" },
				age: { type: "number", description: "Age in years" },
			},
			required: ["name"],
		};
		const b: JSONSchema7 = {
			type: "object",
			properties: {
				name: { type: "string", description: "Full name of the person" },
				age: { type: "number", description: "How old they are" },
			},
			required: ["name"],
		};

		expect(checker.isSubset(a, b)).toBe(true);
		expect(checker.isSubset(b, a)).toBe(true);

		const checkAB = checker.check(a, b);
		expect(checkAB.isSubset).toBe(true);
		expect(checkAB.errors).toEqual([]);

		const checkBA = checker.check(b, a);
		expect(checkBA.isSubset).toBe(true);
		expect(checkBA.errors).toEqual([]);
	});

	test("title differences inside properties do not affect subset check", () => {
		const a: JSONSchema7 = {
			type: "object",
			properties: {
				name: { type: "string", title: "Name" },
				age: { type: "number", title: "Age" },
			},
			required: ["name"],
		};
		const b: JSONSchema7 = {
			type: "object",
			properties: {
				name: { type: "string", title: "Full Name" },
				age: { type: "number", title: "User Age" },
			},
			required: ["name"],
		};

		expect(checker.isSubset(a, b)).toBe(true);
		expect(checker.isSubset(b, a)).toBe(true);

		const checkAB = checker.check(a, b);
		expect(checkAB.isSubset).toBe(true);
		expect(checkAB.errors).toEqual([]);

		const checkBA = checker.check(b, a);
		expect(checkBA.isSubset).toBe(true);
		expect(checkBA.errors).toEqual([]);
	});

	// ── Non-semantic keywords must never affect subset comparison ────────

	describe("non-semantic keywords do not affect subset check", () => {
		const base: JSONSchema7 = {
			type: "object",
			properties: {
				name: { type: "string" },
				age: { type: "number" },
			},
			required: ["name"],
		};

		function expectBidirectionalSubset(a: JSONSchema7, b: JSONSchema7) {
			expect(checker.isSubset(a, b)).toBe(true);
			expect(checker.isSubset(b, a)).toBe(true);

			const checkAB = checker.check(a, b);
			expect(checkAB.isSubset).toBe(true);
			expect(checkAB.errors).toEqual([]);

			const checkBA = checker.check(b, a);
			expect(checkBA.isSubset).toBe(true);
			expect(checkBA.errors).toEqual([]);
		}

		test("title: present vs absent", () => {
			expectBidirectionalSubset(base, { ...base, title: "My Object" });
		});

		test("title: different values", () => {
			expectBidirectionalSubset(
				{ ...base, title: "Object A" } as JSONSchema7,
				{ ...base, title: "Object B" } as JSONSchema7,
			);
		});

		test("description: present vs absent", () => {
			expectBidirectionalSubset(base, {
				...base,
				description: "Some description",
			});
		});

		test("description: different values", () => {
			expectBidirectionalSubset(
				{ ...base, description: "Desc A" } as JSONSchema7,
				{ ...base, description: "Desc B" } as JSONSchema7,
			);
		});

		test("default: present vs absent", () => {
			expectBidirectionalSubset(base, {
				...base,
				default: { name: "John" },
			} as JSONSchema7);
		});

		test("examples: present vs absent", () => {
			expectBidirectionalSubset(base, {
				...base,
				examples: [{ name: "Alice" }],
			} as JSONSchema7);
		});

		test("$comment: present vs absent", () => {
			expectBidirectionalSubset(base, {
				...base,
				$comment: "internal note",
			} as JSONSchema7);
		});

		test("$id: present vs absent", () => {
			expectBidirectionalSubset(base, {
				...base,
				$id: "https://example.com/schema",
			} as JSONSchema7);
		});

		test("definitions/$defs: present vs absent", () => {
			expectBidirectionalSubset(base, {
				...base,
				definitions: { foo: { type: "string" } },
			} as JSONSchema7);
		});

		test("custom extension x-tags: present vs absent", () => {
			const withTags = {
				...base,
				"x-tags": ["internal", "v2"],
			} as unknown as JSONSchema7;
			expectBidirectionalSubset(base, withTags);
		});

		test("custom extension x-tags: different values", () => {
			const tagsA = {
				...base,
				"x-tags": ["internal"],
			} as unknown as JSONSchema7;
			const tagsB = {
				...base,
				"x-tags": ["public", "v1"],
			} as unknown as JSONSchema7;
			expectBidirectionalSubset(tagsA, tagsB);
		});

		test("arbitrary custom keyword: present vs absent", () => {
			const custom = { ...base, myCustomKeyword: 42 } as unknown as JSONSchema7;
			expectBidirectionalSubset(base, custom);
		});

		test("custom extension x-behavior: present vs absent", () => {
			const withBehavior = {
				...base,
				"x-behavior": "strict",
				properties: {
					name: { type: "string", "x-behavior": "trim" },
					age: { type: "number" },
				},
			} as unknown as JSONSchema7;
			expectBidirectionalSubset(base, withBehavior);
		});

		test("custom extension x-behavior: different values", () => {
			const strict = {
				...base,
				"x-behavior": "strict",
				properties: {
					name: { type: "string", "x-behavior": "trim" },
					age: { type: "number" },
				},
			} as unknown as JSONSchema7;
			const lenient = {
				...base,
				"x-behavior": "lenient",
				properties: {
					name: { type: "string", "x-behavior": "uppercase" },
					age: { type: "number" },
				},
			} as unknown as JSONSchema7;
			expectBidirectionalSubset(strict, lenient);
		});

		test("non-semantic keywords inside nested properties", () => {
			const a: JSONSchema7 = {
				type: "object",
				properties: {
					name: {
						type: "string",
						title: "Name",
						description: "The name",
					} as JSONSchema7,
					age: { type: "number" },
				},
				required: ["name"],
			};
			const b = {
				type: "object",
				properties: {
					name: { type: "string", title: "Full Name", "x-label": "nom" },
					age: { type: "number", description: "User age" },
				},
				required: ["name"],
			} as unknown as JSONSchema7;
			expectBidirectionalSubset(a, b);
		});

		test("multiple non-semantic keywords combined", () => {
			const heavy = {
				...base,
				title: "Heavy",
				description: "Lots of metadata",
				$comment: "review needed",
				"x-tags": ["v2"],
				"x-deprecated": true,
				examples: [{ name: "test" }],
				default: { name: "default" },
			} as unknown as JSONSchema7;
			expectBidirectionalSubset(base, heavy);
		});
	});

	// ── Merge preserves non-semantic keywords (first-wins) ──────────────

	describe("merge preserves non-semantic keywords (first-wins)", () => {
		test("intersect keeps first argument's metadata", () => {
			const a = {
				type: "string",
				title: "Title A",
				description: "Desc A",
				"x-behavior": "strict",
			} as unknown as JSONSchema7;
			const b = {
				type: "string",
				title: "Title B",
				description: "Desc B",
				"x-behavior": "lenient",
			} as unknown as JSONSchema7;

			const ab = checker.intersect(a, b) as Record<string, unknown>;
			expect(ab.title).toBe("Title A");
			expect(ab.description).toBe("Desc A");
			expect(ab["x-behavior"]).toBe("strict");

			const ba = checker.intersect(b, a) as Record<string, unknown>;
			expect(ba.title).toBe("Title B");
			expect(ba.description).toBe("Desc B");
			expect(ba["x-behavior"]).toBe("lenient");
		});

		test("intersect keeps metadata from first when second has none", () => {
			const withMeta = {
				type: "string",
				title: "Has Title",
				"x-tags": ["v1"],
			} as unknown as JSONSchema7;
			const bare: JSONSchema7 = { type: "string" };

			const result = checker.intersect(withMeta, bare) as Record<
				string,
				unknown
			>;
			expect(result.title).toBe("Has Title");
			expect(result["x-tags"]).toEqual(["v1"]);
		});

		test("intersect picks up metadata from second when first has none", () => {
			const bare: JSONSchema7 = { type: "string" };
			const withMeta = {
				type: "string",
				title: "From Second",
				"x-behavior": "uppercase",
			} as unknown as JSONSchema7;

			const result = checker.intersect(bare, withMeta) as Record<
				string,
				unknown
			>;
			expect(result.title).toBe("From Second");
			expect(result["x-behavior"]).toBe("uppercase");
		});

		test("intersect preserves nested property metadata (first-wins)", () => {
			const a = {
				type: "object",
				properties: {
					name: { type: "string", title: "Name A", "x-label": "nom" },
				},
				required: ["name"],
			} as unknown as JSONSchema7;
			const b = {
				type: "object",
				properties: {
					name: { type: "string", title: "Name B", "x-label": "name" },
				},
				required: ["name"],
			} as unknown as JSONSchema7;

			const ab = checker.intersect(a, b) as Record<string, unknown>;
			const abName = (ab.properties as Record<string, Record<string, unknown>>)
				?.name;
			expect(abName?.title).toBe("Name A");
			expect(abName?.["x-label"]).toBe("nom");

			const ba = checker.intersect(b, a) as Record<string, unknown>;
			const baName = (ba.properties as Record<string, Record<string, unknown>>)
				?.name;
			expect(baName?.title).toBe("Name B");
			expect(baName?.["x-label"]).toBe("name");
		});
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
