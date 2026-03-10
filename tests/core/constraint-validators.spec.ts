import { beforeAll, describe, expect, test } from "bun:test";
import type { JSONSchema7 } from "json-schema";
import { JsonSchemaCompatibilityChecker } from "../../src";
import type { ConstraintValidator } from "../../src/types.ts";

// ── Constructor tests (from step 5) ──────────────────────────────────────────

describe("constraint validator — constructor", () => {
	test("checker can be created without options (backward compatible)", () => {
		const checker = new JsonSchemaCompatibilityChecker();
		expect(checker).toBeDefined();
	});

	test("checker can be created with empty options", () => {
		const checker = new JsonSchemaCompatibilityChecker({});
		expect(checker).toBeDefined();
	});

	test("checker can be created with constraint validators", () => {
		const isUuid: ConstraintValidator = (value) => ({
			valid: typeof value === "string" && /^[0-9a-f]{8}-/.test(value),
			message: "Must be a UUID",
		});

		const checker = new JsonSchemaCompatibilityChecker({
			constraints: { IsUuid: isUuid },
		});

		expect(checker).toBeDefined();
	});

	test("structural subset check still works with validators registered", () => {
		const checker = new JsonSchemaCompatibilityChecker({
			constraints: {
				IsUuid: (value) => ({
					valid: typeof value === "string",
				}),
			},
		});

		const sub: JSONSchema7 = { type: "string", constraints: ["IsUuid"] };
		const sup: JSONSchema7 = { type: "string", constraints: ["IsUuid"] };

		expect(checker.isSubset(sub, sup)).toBe(true);
	});

	test("structural subset check correctly detects constraint mismatch with validators registered", () => {
		const checker = new JsonSchemaCompatibilityChecker({
			constraints: {
				IsUuid: (value) => ({
					valid: typeof value === "string",
				}),
				IsEmail: (value) => ({
					valid: typeof value === "string",
				}),
			},
		});

		const sub: JSONSchema7 = { type: "string", constraints: ["IsUuid"] };
		const sup: JSONSchema7 = { type: "string", constraints: ["IsEmail"] };

		expect(checker.isSubset(sub, sup)).toBe(false);
	});
});

// ── Runtime validation tests (step 6) ────────────────────────────────────────

describe("constraint validator — runtime validation", () => {
	let checker: JsonSchemaCompatibilityChecker;

	beforeAll(() => {
		checker = new JsonSchemaCompatibilityChecker({
			constraints: {
				IsUuid: (value) => ({
					valid:
						typeof value === "string" &&
						/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
							value,
						),
					message: "Value must be a valid UUID",
				}),
				MinAge: (value, params) => {
					const min = (params?.min as number) ?? 0;
					return {
						valid: typeof value === "number" && value >= min,
						message: `Value must be at least ${min}`,
					};
				},
				AlwaysFails: () => {
					throw new Error("Validator crashed");
				},
			},
		});
	});

	test("valid data passes constraint validation", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				id: { type: "string", constraints: ["IsUuid"] },
			},
			required: ["id"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				id: { type: "string" },
			},
			required: ["id"],
		};

		const result = checker.check(sub, sup, {
			data: { id: "550e8400-e29b-41d4-a716-446655440000" },
			validate: true,
		});

		expect(result.isSubset).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	test("invalid data fails constraint validation", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				id: { type: "string", constraints: ["IsUuid"] },
			},
			required: ["id"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				id: { type: "string" },
			},
			required: ["id"],
		};

		const result = checker.check(sub, sup, {
			data: { id: "not-a-uuid" },
			validate: true,
		});

		expect(result.isSubset).toBe(false);
		expect(result.errors.length).toBeGreaterThan(0);
		expect(result.errors).toContainEqual(
			expect.objectContaining({
				key: expect.stringContaining("id"),
				expected: expect.stringContaining("IsUuid"),
			}),
		);
	});

	test("constraint with params validates correctly — valid", () => {
		const schema: JSONSchema7 = {
			type: "object",
			properties: {
				age: {
					type: "number",
					constraints: [{ name: "MinAge", params: { min: 18 } }],
				},
			},
			required: ["age"],
		};

		const result = checker.check(schema, schema, {
			data: { age: 21 },
			validate: true,
		});
		expect(result.isSubset).toBe(true);
	});

	test("constraint with params validates correctly — invalid", () => {
		const schema: JSONSchema7 = {
			type: "object",
			properties: {
				age: {
					type: "number",
					constraints: [{ name: "MinAge", params: { min: 18 } }],
				},
			},
			required: ["age"],
		};

		const result = checker.check(schema, schema, {
			data: { age: 15 },
			validate: true,
		});
		expect(result.isSubset).toBe(false);
		expect(result.errors).toContainEqual(
			expect.objectContaining({
				expected: expect.stringContaining("MinAge"),
			}),
		);
	});

	test("unknown constraint name produces error", () => {
		const schema: JSONSchema7 = {
			type: "object",
			properties: {
				value: { type: "string", constraints: ["NonExistent"] },
			},
			required: ["value"],
		};

		const result = checker.check(schema, schema, {
			data: { value: "hello" },
			validate: true,
		});

		expect(result.isSubset).toBe(false);
		expect(result.errors).toContainEqual(
			expect.objectContaining({
				expected: expect.stringContaining("NonExistent"),
				received: expect.stringContaining("not registered"),
			}),
		);
	});

	test("validator that throws is caught and reported", () => {
		const schema: JSONSchema7 = {
			type: "object",
			properties: {
				value: { type: "string", constraints: ["AlwaysFails"] },
			},
			required: ["value"],
		};

		const result = checker.check(schema, schema, {
			data: { value: "hello" },
			validate: true,
		});

		expect(result.isSubset).toBe(false);
		expect(result.errors).toContainEqual(
			expect.objectContaining({
				expected: expect.stringContaining("AlwaysFails"),
				received: expect.stringContaining("Validator crashed"),
			}),
		);
	});

	test("no constraint validators registered → constraints are not validated at runtime", () => {
		const checkerNoValidators = new JsonSchemaCompatibilityChecker();

		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				id: { type: "string", constraints: ["IsUuid"] },
			},
			required: ["id"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				id: { type: "string", constraints: ["IsUuid"] },
			},
			required: ["id"],
		};

		// Even with invalid data, no constraint errors because no validators registered
		const result = checkerNoValidators.check(sub, sup, {
			data: { id: "not-a-uuid" },
			validate: true,
		});

		// Static check passes (same constraints), and no runtime constraint errors
		expect(result.isSubset).toBe(true);
	});

	test("check without data does not trigger constraint validation", () => {
		const sub: JSONSchema7 = {
			type: "string",
			constraints: ["IsUuid"],
		};
		const sup: JSONSchema7 = {
			type: "string",
			constraints: ["IsUuid"],
		};

		// Static check only (no data) → no runtime validation at all
		const result = checker.check(sub, sup);
		expect(result.isSubset).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	test("constraints on sup are also validated against data (prefixed with $sup)", () => {
		// Both schemas have the same constraint so the static check passes.
		// The runtime data violates the constraint, producing errors on both sides.
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				id: { type: "string", constraints: ["IsUuid"] },
			},
			required: ["id"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				id: { type: "string", constraints: ["IsUuid"] },
			},
			required: ["id"],
		};

		const result = checker.check(sub, sup, {
			data: { id: "not-a-uuid" },
			validate: true,
		});

		expect(result.isSubset).toBe(false);
		// Error should be prefixed with $sup since sup's constraint also failed
		expect(result.errors).toContainEqual(
			expect.objectContaining({
				key: "$sup.id",
			}),
		);
	});

	test("constraints on sub are prefixed with $sub", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				id: { type: "string", constraints: ["IsUuid"] },
			},
			required: ["id"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				id: { type: "string" },
			},
			required: ["id"],
		};

		const result = checker.check(sub, sup, {
			data: { id: "not-a-uuid" },
			validate: true,
		});

		expect(result.isSubset).toBe(false);
		expect(result.errors).toContainEqual(
			expect.objectContaining({
				key: "$sub.id",
			}),
		);
	});

	test("nested property constraints are validated", () => {
		const schema: JSONSchema7 = {
			type: "object",
			properties: {
				user: {
					type: "object",
					properties: {
						id: { type: "string", constraints: ["IsUuid"] },
					},
					required: ["id"],
				},
			},
			required: ["user"],
		};

		const result = checker.check(schema, schema, {
			data: { user: { id: "not-a-uuid" } },
			validate: true,
		});

		expect(result.isSubset).toBe(false);
		// The error key should contain the nested path user.id
		const constraintError = result.errors.find((e) =>
			e.expected.includes("IsUuid"),
		);
		expect(constraintError).toBeDefined();
		expect(constraintError?.key).toContain("user");
		expect(constraintError?.key).toContain("id");
	});

	test("array item constraints are validated", () => {
		const schema: JSONSchema7 = {
			type: "object",
			properties: {
				ids: {
					type: "array",
					items: { type: "string", constraints: ["IsUuid"] },
				},
			},
			required: ["ids"],
		};

		const result = checker.check(schema, schema, {
			data: {
				ids: ["550e8400-e29b-41d4-a716-446655440000", "not-a-uuid"],
			},
			validate: true,
		});

		expect(result.isSubset).toBe(false);
		expect(result.errors.length).toBeGreaterThan(0);
	});

	test("root-level constraints use $root path", () => {
		const schema: JSONSchema7 = {
			type: "string",
			constraints: ["IsUuid"],
		};

		const result = checker.check(schema, schema, {
			data: "not-a-uuid",
			validate: true,
		});

		expect(result.isSubset).toBe(false);
		// Root-level constraint errors should be prefixed as $sub / $sup (from $root)
		const hasSubError = result.errors.some((e) => e.key === "$sub");
		const hasSupError = result.errors.some((e) => e.key === "$sup");
		expect(hasSubError || hasSupError).toBe(true);
	});

	test("both sub and sup constraints fail — errors from both sides", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				id: { type: "string", constraints: ["IsUuid"] },
			},
			required: ["id"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				id: { type: "string", constraints: ["IsUuid"] },
			},
			required: ["id"],
		};

		const result = checker.check(sub, sup, {
			data: { id: "not-a-uuid" },
			validate: true,
		});

		expect(result.isSubset).toBe(false);

		const subErrors = result.errors.filter((e) => e.key.startsWith("$sub"));
		const supErrors = result.errors.filter((e) => e.key.startsWith("$sup"));

		expect(subErrors.length).toBeGreaterThan(0);
		expect(supErrors.length).toBeGreaterThan(0);
	});

	test("property not present in data → constraint not validated", () => {
		const schema: JSONSchema7 = {
			type: "object",
			properties: {
				id: { type: "string", constraints: ["IsUuid"] },
				name: { type: "string" },
			},
		};

		// Data has no "id" property — constraint on id should not be validated
		const result = checker.check(schema, schema, {
			data: { name: "test" },
			validate: true,
		});

		expect(result.isSubset).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	test("multiple constraints on same property — all validated", () => {
		const multiChecker = new JsonSchemaCompatibilityChecker({
			constraints: {
				IsString: (value) => ({
					valid: typeof value === "string",
					message: "Must be a string",
				}),
				IsUuid: (value) => ({
					valid:
						typeof value === "string" &&
						/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
							value,
						),
					message: "Must be a UUID",
				}),
			},
		});

		const schema: JSONSchema7 = {
			type: "object",
			properties: {
				id: { type: "string", constraints: ["IsString", "IsUuid"] },
			},
			required: ["id"],
		};

		// Passes IsString but fails IsUuid
		const result = multiChecker.check(schema, schema, {
			data: { id: "not-a-uuid" },
			validate: true,
		});

		expect(result.isSubset).toBe(false);
		expect(result.errors).toContainEqual(
			expect.objectContaining({
				expected: expect.stringContaining("IsUuid"),
			}),
		);
	});

	test("valid array items all pass constraint validation", () => {
		const schema: JSONSchema7 = {
			type: "object",
			properties: {
				ids: {
					type: "array",
					items: { type: "string", constraints: ["IsUuid"] },
				},
			},
			required: ["ids"],
		};

		const result = checker.check(schema, schema, {
			data: {
				ids: [
					"550e8400-e29b-41d4-a716-446655440000",
					"6ba7b810-9dad-11d1-80b4-00c04fd430c8",
				],
			},
			validate: true,
		});

		expect(result.isSubset).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	// ── patternProperties recursion ──────────────────────────────────────────

	test("constraints inside patternProperties are validated", () => {
		const schema: JSONSchema7 = {
			type: "object",
			patternProperties: {
				"^x-": { type: "string", constraints: ["IsUuid"] },
			},
		};

		const result = checker.check(schema, schema, {
			data: { "x-id": "not-a-uuid" },
			validate: true,
		});

		expect(result.isSubset).toBe(false);
		expect(result.errors).toContainEqual(
			expect.objectContaining({
				expected: expect.stringContaining("IsUuid"),
			}),
		);
	});

	test("valid data in patternProperties passes constraint validation", () => {
		const schema: JSONSchema7 = {
			type: "object",
			patternProperties: {
				"^x-": { type: "string", constraints: ["IsUuid"] },
			},
		};

		const result = checker.check(schema, schema, {
			data: { "x-id": "550e8400-e29b-41d4-a716-446655440000" },
			validate: true,
		});

		expect(result.isSubset).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	test("data keys not matching patternProperties pattern are not validated against it", () => {
		const schema: JSONSchema7 = {
			type: "object",
			patternProperties: {
				"^x-": { type: "string", constraints: ["IsUuid"] },
			},
		};

		// "name" does not match "^x-" → no constraint validation
		const result = checker.check(schema, schema, {
			data: { name: "not-a-uuid" },
			validate: true,
		});

		expect(result.isSubset).toBe(true);
	});

	// ── additionalProperties recursion ───────────────────────────────────────

	test("constraints inside additionalProperties are validated", () => {
		const schema: JSONSchema7 = {
			type: "object",
			properties: { name: { type: "string" } },
			additionalProperties: { type: "string", constraints: ["IsUuid"] },
		};

		const result = checker.check(schema, schema, {
			data: { name: "Alice", extraField: "not-a-uuid" },
			validate: true,
		});

		expect(result.isSubset).toBe(false);
		expect(result.errors).toContainEqual(
			expect.objectContaining({
				expected: expect.stringContaining("IsUuid"),
			}),
		);
	});

	test("defined properties are NOT validated against additionalProperties schema", () => {
		const schema: JSONSchema7 = {
			type: "object",
			properties: { name: { type: "string" } },
			additionalProperties: { type: "string", constraints: ["IsUuid"] },
		};

		// "name" is in properties → not validated against additionalProperties
		const result = checker.check(schema, schema, {
			data: { name: "not-a-uuid" },
			validate: true,
		});

		expect(result.isSubset).toBe(true);
	});

	test("valid additional properties pass constraint validation", () => {
		const schema: JSONSchema7 = {
			type: "object",
			properties: { name: { type: "string" } },
			additionalProperties: { type: "string", constraints: ["IsUuid"] },
		};

		const result = checker.check(schema, schema, {
			data: { name: "Alice", extra: "550e8400-e29b-41d4-a716-446655440000" },
			validate: true,
		});

		expect(result.isSubset).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	test("patternProperties keys excluded from additionalProperties validation", () => {
		const schema: JSONSchema7 = {
			type: "object",
			properties: { name: { type: "string" } },
			patternProperties: {
				"^x-": { type: "string" },
			},
			additionalProperties: { type: "string", constraints: ["IsUuid"] },
		};

		// "x-custom" matches patternProperties "^x-" → NOT additional
		// → should NOT be validated against additionalProperties constraints
		const result = checker.check(schema, schema, {
			data: { name: "Alice", "x-custom": "not-a-uuid" },
			validate: true,
		});

		expect(result.isSubset).toBe(true);
	});

	// ── dependencies (schema form) recursion ─────────────────────────────────

	test("constraints inside schema-form dependencies are validated", () => {
		const schema: JSONSchema7 = {
			type: "object",
			properties: {
				foo: { type: "string" },
			},
			dependencies: {
				foo: {
					properties: {
						bar: { type: "string", constraints: ["IsUuid"] },
					},
				},
			},
		};

		const result = checker.check(schema, schema, {
			data: { foo: "hello", bar: "not-a-uuid" },
			validate: true,
		});

		expect(result.isSubset).toBe(false);
		expect(result.errors).toContainEqual(
			expect.objectContaining({
				expected: expect.stringContaining("IsUuid"),
			}),
		);
	});

	test("schema-form dependency not triggered when key is absent", () => {
		const schema: JSONSchema7 = {
			type: "object",
			properties: {
				foo: { type: "string" },
			},
			dependencies: {
				foo: {
					properties: {
						bar: { type: "string", constraints: ["IsUuid"] },
					},
				},
			},
		};

		// "foo" is absent → dependency not triggered → bar constraint not checked
		const result = checker.check(schema, schema, {
			data: { bar: "not-a-uuid" },
			validate: true,
		});

		expect(result.isSubset).toBe(true);
	});

	test("array-form dependencies do not trigger constraint validation", () => {
		const schema: JSONSchema7 = {
			type: "object",
			properties: {
				foo: { type: "string" },
				bar: { type: "string", constraints: ["IsUuid"] },
			},
			dependencies: {
				foo: ["bar"],
			},
		};

		// Array-form dependency only asserts presence of "bar", not constraints.
		// The constraint on "bar" is in properties, and bar is present → validated there.
		const result = checker.check(schema, schema, {
			data: { foo: "hello", bar: "550e8400-e29b-41d4-a716-446655440000" },
			validate: true,
		});

		expect(result.isSubset).toBe(true);
	});
});
