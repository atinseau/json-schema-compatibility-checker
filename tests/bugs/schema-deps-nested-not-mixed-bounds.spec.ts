import { beforeAll, describe, expect, test } from "bun:test";
import type { JSONSchema7 } from "json-schema";
import { JsonSchemaCompatibilityChecker } from "../../src";

let checker: JsonSchemaCompatibilityChecker;

beforeAll(() => {
	checker = new JsonSchemaCompatibilityChecker();
});

// ── Bug 1 — schema-form dependencies: stripDependenciesFromSup + semantic errors ──

describe("Bug 1 — schema-form dependencies", () => {
	test("sub satisfying schema-form dependency via required + compatible properties", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				creditCard: { type: "string" },
				billingAddress: { type: "string", minLength: 5 },
			},
			required: ["creditCard", "billingAddress"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				creditCard: { type: "string" },
				billingAddress: { type: "string" },
			},
			required: ["creditCard", "billingAddress"],
			dependencies: {
				creditCard: {
					properties: {
						billingAddress: { type: "string", minLength: 5 },
					},
					required: ["billingAddress"],
				},
			},
		};
		const result = checker.check(sub, sup);
		expect(result.isSubset).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	test("isSubset() agrees with check() for schema-form dependency", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				creditCard: { type: "string" },
				billingAddress: { type: "string", minLength: 5 },
			},
			required: ["creditCard", "billingAddress"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				creditCard: { type: "string" },
				billingAddress: { type: "string" },
			},
			required: ["creditCard", "billingAddress"],
			dependencies: {
				creditCard: {
					properties: {
						billingAddress: { type: "string", minLength: 5 },
					},
					required: ["billingAddress"],
				},
			},
		};
		expect(checker.isSubset(sub, sup)).toBe(true);
	});

	test("sub NOT satisfying schema-form dependency (missing required) returns false", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				creditCard: { type: "string" },
				billingAddress: { type: "string" },
			},
			required: ["creditCard"],
			// billingAddress is NOT required, but dep requires it
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				creditCard: { type: "string" },
				billingAddress: { type: "string" },
			},
			required: ["creditCard"],
			dependencies: {
				creditCard: {
					properties: {
						billingAddress: { type: "string", minLength: 5 },
					},
					required: ["billingAddress"],
				},
			},
		};
		expect(checker.isSubset(sub, sup)).toBe(false);
	});

	test("sub NOT satisfying schema-form dependency (weaker constraint) returns false", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				creditCard: { type: "string" },
				billingAddress: { type: "string", minLength: 3 },
			},
			required: ["creditCard", "billingAddress"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				creditCard: { type: "string" },
				billingAddress: { type: "string" },
			},
			required: ["creditCard", "billingAddress"],
			dependencies: {
				creditCard: {
					properties: {
						billingAddress: { type: "string", minLength: 5 },
					},
					required: ["billingAddress"],
				},
			},
		};
		expect(checker.isSubset(sub, sup)).toBe(false);
	});

	test("schema-form dependency with trigger never produced (vacuously true)", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				name: { type: "string" },
			},
			required: ["name"],
			additionalProperties: false,
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				name: { type: "string" },
			},
			required: ["name"],
			additionalProperties: false,
			dependencies: {
				creditCard: {
					properties: {
						billingAddress: { type: "string", minLength: 5 },
					},
					required: ["billingAddress"],
				},
			},
		};
		// creditCard can never be produced by sub → dependency is vacuously true
		expect(checker.isSubset(sub, sup)).toBe(true);
	});

	test("check() errors are empty when schema-form dependency is satisfied", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				username: { type: "string" },
				email: { type: "string", format: "email" },
			},
			required: ["username", "email"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				username: { type: "string" },
				email: { type: "string" },
			},
			required: ["username", "email"],
			dependencies: {
				username: {
					required: ["email"],
				},
			},
		};
		const result = checker.check(sub, sup);
		expect(result.isSubset).toBe(true);
		expect(result.errors).toHaveLength(0);
	});
});

// ── Bug 2 — nested not + enum: type_mismatch false positive ──

describe("Bug 2 — nested not + enum type_mismatch", () => {
	test("check() returns isSubset: true for nested property with enum + not const", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				user: {
					type: "object",
					properties: {
						status: { type: "string", enum: ["active"] },
					},
					required: ["status"],
				},
			},
			required: ["user"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				user: {
					type: "object",
					properties: {
						status: { type: "string", not: { const: "banned" } },
					},
					required: ["status"],
				},
			},
			required: ["user"],
		};
		const result = checker.check(sub, sup);
		expect(result.isSubset).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	test("isSubset() returns true for nested property with enum + not const", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				user: {
					type: "object",
					properties: {
						status: { type: "string", enum: ["active"] },
					},
					required: ["status"],
				},
			},
			required: ["user"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				user: {
					type: "object",
					properties: {
						status: { type: "string", not: { const: "banned" } },
					},
					required: ["status"],
				},
			},
			required: ["user"],
		};
		expect(checker.isSubset(sub, sup)).toBe(true);
	});

	test("3 levels deep: not + const is stripped recursively", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				level1: {
					type: "object",
					properties: {
						level2: {
							type: "object",
							properties: {
								value: { type: "string", enum: ["ok"] },
							},
							required: ["value"],
						},
					},
					required: ["level2"],
				},
			},
			required: ["level1"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				level1: {
					type: "object",
					properties: {
						level2: {
							type: "object",
							properties: {
								value: { type: "string", not: { const: "error" } },
							},
							required: ["value"],
						},
					},
					required: ["level2"],
				},
			},
			required: ["level1"],
		};
		expect(checker.isSubset(sub, sup)).toBe(true);
		const result = checker.check(sub, sup);
		expect(result.isSubset).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	test("nested not where sub violates the not → correctly returns false", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				user: {
					type: "object",
					properties: {
						status: { type: "string", const: "banned" },
					},
					required: ["status"],
				},
			},
			required: ["user"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				user: {
					type: "object",
					properties: {
						status: { type: "string", not: { const: "banned" } },
					},
					required: ["status"],
				},
			},
			required: ["user"],
		};
		expect(checker.isSubset(sub, sup)).toBe(false);
	});

	test("multiple properties: one with not, one without", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				user: {
					type: "object",
					properties: {
						status: { type: "string", enum: ["active"] },
						role: { type: "string", enum: ["admin"] },
					},
					required: ["status", "role"],
				},
			},
			required: ["user"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				user: {
					type: "object",
					properties: {
						status: { type: "string", not: { const: "banned" } },
						role: { type: "string" },
					},
					required: ["status", "role"],
				},
			},
			required: ["user"],
		};
		expect(checker.isSubset(sub, sup)).toBe(true);
	});
});

// ── Bug 3 — mixed exclusive/inclusive bounds ──

describe("Bug 3 — mixed exclusive/inclusive numeric bounds", () => {
	test("sub.exclusiveMinimum: 5 ⊆ sup.minimum: 5", () => {
		const result = checker.check(
			{ type: "number", exclusiveMinimum: 5 },
			{ type: "number", minimum: 5 },
		);
		expect(result.isSubset).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	test("sub.minimum: 6 ⊆ sup.exclusiveMinimum: 5", () => {
		const result = checker.check(
			{ type: "number", minimum: 6 },
			{ type: "number", exclusiveMinimum: 5 },
		);
		expect(result.isSubset).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	test("sub.exclusiveMaximum: 100 ⊆ sup.maximum: 100", () => {
		const result = checker.check(
			{ type: "number", exclusiveMaximum: 100 },
			{ type: "number", maximum: 100 },
		);
		expect(result.isSubset).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	test("sub.maximum: 99 ⊆ sup.exclusiveMaximum: 100", () => {
		const result = checker.check(
			{ type: "number", maximum: 99 },
			{ type: "number", exclusiveMaximum: 100 },
		);
		expect(result.isSubset).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	test("sub.minimum: 5 ⊄ sup.exclusiveMinimum: 5 (boundary not excluded)", () => {
		const result = checker.check(
			{ type: "number", minimum: 5 },
			{ type: "number", exclusiveMinimum: 5 },
		);
		expect(result.isSubset).toBe(false);
	});

	test("sub.maximum: 100 ⊄ sup.exclusiveMaximum: 100 (boundary not excluded)", () => {
		const result = checker.check(
			{ type: "number", maximum: 100 },
			{ type: "number", exclusiveMaximum: 100 },
		);
		expect(result.isSubset).toBe(false);
	});

	test("isSubset() and check() agree on mixed bounds", () => {
		const pairs: [JSONSchema7, JSONSchema7][] = [
			[
				{ type: "number", exclusiveMinimum: 5 },
				{ type: "number", minimum: 5 },
			],
			[
				{ type: "number", minimum: 6 },
				{ type: "number", exclusiveMinimum: 5 },
			],
			[
				{ type: "number", exclusiveMaximum: 100 },
				{ type: "number", maximum: 100 },
			],
			[
				{ type: "number", maximum: 99 },
				{ type: "number", exclusiveMaximum: 100 },
			],
		];
		for (const [sub, sup] of pairs) {
			const subsetResult = checker.isSubset(sub, sup);
			const checkResult = checker.check(sub, sup);
			expect(checkResult.isSubset).toBe(subsetResult);
			expect(checkResult.isSubset).toBe(true);
			expect(checkResult.errors).toHaveLength(0);
		}
	});

	test("integer type also works with mixed bounds", () => {
		expect(
			checker.isSubset(
				{ type: "integer", exclusiveMinimum: 0 },
				{ type: "integer", minimum: 0 },
			),
		).toBe(true);
		expect(
			checker.isSubset(
				{ type: "integer", minimum: 1 },
				{ type: "integer", exclusiveMinimum: 0 },
			),
		).toBe(true);
	});
});
