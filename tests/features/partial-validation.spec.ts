import { beforeAll, describe, expect, test } from "bun:test";
import type { JSONSchema7 } from "json-schema";
import { JsonSchemaCompatibilityChecker } from "../../src";
import type { ConstraintValidator } from "../../src/types.ts";

// ── Shared schemas ───────────────────────────────────────────────────────────

const objectWithRequired: JSONSchema7 = {
	type: "object",
	properties: {
		accountId: {
			type: "string",
			enum: ["salut", "coucou"],
		},
		meetingId: { type: "string" },
		extraField: { type: "number" },
	},
	required: ["accountId", "meetingId", "extraField"],
};

const objectWithRequiredAndAdditional: JSONSchema7 = {
	type: "object",
	properties: {
		accountId: {
			type: "string",
			enum: ["salut", "coucou"],
		},
		meetingId: { type: "string" },
	},
	required: ["accountId", "meetingId"],
	additionalProperties: false,
};

// ── Basic partial validation ─────────────────────────────────────────────────

describe("partial validation — basic", () => {
	let checker: JsonSchemaCompatibilityChecker;

	beforeAll(() => {
		checker = new JsonSchemaCompatibilityChecker();
	});

	test("partial data with valid values → no errors (Case 1)", async () => {
		const result = await checker.check(objectWithRequired, objectWithRequired, {
			data: { accountId: "salut" },
			validate: { sup: { partial: true } },
		});

		expect(result.isSubset).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	test("non-partial mode reports missing required properties", async () => {
		const result = await checker.check(objectWithRequired, objectWithRequired, {
			data: { accountId: "salut" },
			validate: { sup: true },
		});

		expect(result.isSubset).toBe(false);
		const supErrors = result.errors.filter((e) => e.key.startsWith("$sup"));
		// Should have errors for meetingId and extraField being missing
		expect(supErrors.length).toBeGreaterThanOrEqual(2);
	});

	test("partial data with invalid enum value → enum error only (Case 2)", async () => {
		const result = await checker.check(objectWithRequired, objectWithRequired, {
			data: { accountId: "bad_value" },
			validate: { sup: { partial: true } },
		});

		expect(result.isSubset).toBe(false);
		expect(result.errors.length).toBeGreaterThanOrEqual(1);

		// Should have an enum error for accountId
		const accountIdError = result.errors.find((e) =>
			e.key.includes("accountId"),
		);
		expect(accountIdError).toBeDefined();

		// Should NOT have errors for meetingId or extraField
		const meetingIdError = result.errors.find((e) =>
			e.key.includes("meetingId"),
		);
		const extraFieldError = result.errors.find((e) =>
			e.key.includes("extraField"),
		);
		expect(meetingIdError).toBeUndefined();
		expect(extraFieldError).toBeUndefined();
	});

	test("partial data with extra properties → no additionalProperties error (Case 4)", async () => {
		const result = await checker.check(
			objectWithRequiredAndAdditional,
			objectWithRequiredAndAdditional,
			{
				data: { accountId: "salut", unknownField: "hello" },
				validate: { sup: { partial: true } },
			},
		);

		expect(result.isSubset).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	test("non-partial mode rejects extra properties when additionalProperties: false", async () => {
		const result = await checker.check(
			objectWithRequiredAndAdditional,
			objectWithRequiredAndAdditional,
			{
				data: { accountId: "salut", meetingId: "abc", unknownField: "hello" },
				validate: { sup: true },
			},
		);

		expect(result.isSubset).toBe(false);
		const apError = result.errors.find((e) => e.key.includes("unknownField"));
		expect(apError).toBeDefined();
	});

	test("partial data with wrong type → type error (Case 5)", async () => {
		const result = await checker.check(objectWithRequired, objectWithRequired, {
			data: { accountId: 123 },
			validate: { sup: { partial: true } },
		});

		expect(result.isSubset).toBe(false);
		expect(result.errors.length).toBeGreaterThanOrEqual(1);

		const typeError = result.errors.find((e) => e.key.includes("accountId"));
		expect(typeError).toBeDefined();
	});

	test("partial data with all valid properties → no errors", async () => {
		const result = await checker.check(objectWithRequired, objectWithRequired, {
			data: { accountId: "salut", meetingId: "abc", extraField: 42 },
			validate: { sup: { partial: true } },
		});

		expect(result.isSubset).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	test("partial data with empty object → no errors (nothing to validate)", async () => {
		const result = await checker.check(objectWithRequired, objectWithRequired, {
			data: {},
			validate: { sup: { partial: true } },
		});

		expect(result.isSubset).toBe(true);
		expect(result.errors).toHaveLength(0);
	});
});

// ── Nested object partial validation ─────────────────────────────────────────

describe("partial validation — nested objects (Case 6)", () => {
	let checker: JsonSchemaCompatibilityChecker;

	const nestedSchema: JSONSchema7 = {
		type: "object",
		properties: {
			user: {
				type: "object",
				properties: {
					name: { type: "string" },
					role: { type: "string", enum: ["admin", "user"] },
				},
				required: ["name", "role"],
			},
			meetingId: { type: "string" },
		},
		required: ["user", "meetingId"],
	};

	beforeAll(() => {
		checker = new JsonSchemaCompatibilityChecker();
	});

	test("nested partial data with invalid enum → error for present property only", async () => {
		const result = await checker.check(nestedSchema, nestedSchema, {
			data: { user: { role: "invalid_role" } },
			validate: { sup: { partial: true } },
		});

		expect(result.isSubset).toBe(false);

		// Should have an error for role
		const roleError = result.errors.find((e) => e.key.includes("role"));
		expect(roleError).toBeDefined();

		// Should NOT have errors for missing user.name or meetingId
		const nameError = result.errors.find(
			(e) => e.key.includes("name") && e.received === "undefined",
		);
		const meetingIdError = result.errors.find((e) =>
			e.key.includes("meetingId"),
		);
		expect(nameError).toBeUndefined();
		expect(meetingIdError).toBeUndefined();
	});

	test("nested partial data with valid values → no errors", async () => {
		const result = await checker.check(nestedSchema, nestedSchema, {
			data: { user: { role: "admin" } },
			validate: { sup: { partial: true } },
		});

		expect(result.isSubset).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	test("deeply nested partial data → only validates present properties", async () => {
		const deepSchema: JSONSchema7 = {
			type: "object",
			properties: {
				level1: {
					type: "object",
					properties: {
						level2: {
							type: "object",
							properties: {
								value: { type: "number", minimum: 10 },
								label: { type: "string" },
							},
							required: ["value", "label"],
						},
						other: { type: "string" },
					},
					required: ["level2", "other"],
				},
			},
			required: ["level1"],
		};

		const result = await checker.check(deepSchema, deepSchema, {
			data: { level1: { level2: { value: 5 } } },
			validate: { sup: { partial: true } },
		});

		expect(result.isSubset).toBe(false);
		// Should have minimum error for value (5 < 10)
		const minError = result.errors.find((e) => e.key.includes("value"));
		expect(minError).toBeDefined();

		// Should NOT have required errors for label, other, etc.
		const requiredErrors = result.errors.filter(
			(e) => e.received === "undefined",
		);
		expect(requiredErrors).toHaveLength(0);
	});
});

// ── Constraint validation with partial mode ──────────────────────────────────

describe("partial validation — constraints (Case 3)", () => {
	test("constraint failure on present property → constraint error only", async () => {
		const alwaysFails: ConstraintValidator = () => ({
			valid: false,
			message: "Not found",
		});

		const checker = new JsonSchemaCompatibilityChecker({
			constraints: { NotFoundConstraint: alwaysFails },
		});

		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				accountId: {
					type: "string",
					enum: ["salut", "coucou"],
					constraints: ["NotFoundConstraint"],
				},
				meetingId: { type: "string" },
				extraField: { type: "number" },
			},
			required: ["accountId", "meetingId", "extraField"],
		};

		const result = await checker.check(sup, sup, {
			data: { accountId: "salut" },
			validate: { sup: { partial: true } },
		});

		expect(result.isSubset).toBe(false);

		// Should have a constraint error for accountId
		const constraintError = result.errors.find(
			(e) =>
				e.key.includes("accountId") &&
				e.expected.includes("NotFoundConstraint"),
		);
		expect(constraintError).toBeDefined();

		// Should NOT have required errors for meetingId or extraField
		const meetingIdError = result.errors.find((e) =>
			e.key.includes("meetingId"),
		);
		const extraFieldError = result.errors.find((e) =>
			e.key.includes("extraField"),
		);
		expect(meetingIdError).toBeUndefined();
		expect(extraFieldError).toBeUndefined();
	});

	test("constraint passes on present property → no errors", async () => {
		const alwaysPasses: ConstraintValidator = () => ({
			valid: true,
		});

		const checker = new JsonSchemaCompatibilityChecker({
			constraints: { AlwaysValid: alwaysPasses },
		});

		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				accountId: {
					type: "string",
					enum: ["salut", "coucou"],
					constraints: ["AlwaysValid"],
				},
				meetingId: { type: "string" },
			},
			required: ["accountId", "meetingId"],
		};

		const result = await checker.check(sup, sup, {
			data: { accountId: "salut" },
			validate: { sup: { partial: true } },
		});

		expect(result.isSubset).toBe(true);
		expect(result.errors).toHaveLength(0);
	});
});

// ── Partial on sub target ────────────────────────────────────────────────────

describe("partial validation — sub target", () => {
	let checker: JsonSchemaCompatibilityChecker;

	beforeAll(() => {
		checker = new JsonSchemaCompatibilityChecker();
	});

	test("partial mode on sub skips required for sub schema", async () => {
		const schema: JSONSchema7 = {
			type: "object",
			properties: {
				name: { type: "string" },
				age: { type: "number" },
			},
			required: ["name", "age"],
		};

		const result = await checker.check(schema, schema, {
			data: { name: "Alice" },
			validate: { sub: { partial: true } },
		});

		expect(result.isSubset).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	test("partial mode on sub still reports type errors", async () => {
		const schema: JSONSchema7 = {
			type: "object",
			properties: {
				name: { type: "string" },
				age: { type: "number" },
			},
			required: ["name", "age"],
		};

		const result = await checker.check(schema, schema, {
			data: { name: 123 },
			validate: { sub: { partial: true } },
		});

		expect(result.isSubset).toBe(false);
		const typeError = result.errors.find((e) => e.key.includes("name"));
		expect(typeError).toBeDefined();
	});
});

// ── Mixed partial/non-partial ────────────────────────────────────────────────

describe("partial validation — mixed targets", () => {
	let checker: JsonSchemaCompatibilityChecker;

	beforeAll(() => {
		checker = new JsonSchemaCompatibilityChecker();
	});

	test("partial on sup, full on sub", async () => {
		const schema: JSONSchema7 = {
			type: "object",
			properties: {
				name: { type: "string" },
				age: { type: "number" },
			},
			required: ["name", "age"],
		};

		const result = await checker.check(schema, schema, {
			data: { name: "Alice" },
			validate: { sub: true, sup: { partial: true } },
		});

		// sub (full mode) should fail on missing required property "age"
		expect(result.isSubset).toBe(false);
		const subErrors = result.errors.filter((e) => e.key.startsWith("$sub"));
		expect(subErrors.length).toBeGreaterThanOrEqual(1);

		// sup (partial mode) should NOT have required errors
		const supRequiredErrors = result.errors.filter(
			(e) => e.key.startsWith("$sup") && e.received === "undefined",
		);
		expect(supRequiredErrors).toHaveLength(0);
	});

	test("partial on sub, full on sup", async () => {
		const schema: JSONSchema7 = {
			type: "object",
			properties: {
				name: { type: "string" },
				age: { type: "number" },
			},
			required: ["name", "age"],
		};

		const result = await checker.check(schema, schema, {
			data: { name: "Alice" },
			validate: { sub: { partial: true }, sup: true },
		});

		// sup (full mode) should fail on missing required property "age"
		expect(result.isSubset).toBe(false);
		const supErrors = result.errors.filter((e) => e.key.startsWith("$sup"));
		expect(supErrors.length).toBeGreaterThanOrEqual(1);

		// sub (partial mode) should NOT have required errors
		const subRequiredErrors = result.errors.filter(
			(e) => e.key.startsWith("$sub") && e.received === "undefined",
		);
		expect(subRequiredErrors).toHaveLength(0);
	});

	test("partial on both sub and sup", async () => {
		const schema: JSONSchema7 = {
			type: "object",
			properties: {
				name: { type: "string" },
				age: { type: "number" },
			},
			required: ["name", "age"],
		};

		const result = await checker.check(schema, schema, {
			data: { name: "Alice" },
			validate: { sub: { partial: true }, sup: { partial: true } },
		});

		expect(result.isSubset).toBe(true);
		expect(result.errors).toHaveLength(0);
	});
});

// ── Edge cases ───────────────────────────────────────────────────────────────

describe("partial validation — edge cases", () => {
	let checker: JsonSchemaCompatibilityChecker;

	beforeAll(() => {
		checker = new JsonSchemaCompatibilityChecker();
	});

	test("partial mode with non-object data passes through to AJV normally", async () => {
		const schema: JSONSchema7 = { type: "string", minLength: 3 };

		const result = await checker.check(schema, schema, {
			data: "hi",
			validate: { sup: { partial: true } },
		});

		expect(result.isSubset).toBe(false);
		expect(result.errors.length).toBeGreaterThanOrEqual(1);
	});

	test("partial mode on a schema without required or additionalProperties → no difference", async () => {
		const schema: JSONSchema7 = {
			type: "object",
			properties: {
				name: { type: "string" },
			},
		};

		const resultPartial = await checker.check(schema, schema, {
			data: { name: "Alice" },
			validate: { sup: { partial: true } },
		});

		const resultFull = await checker.check(schema, schema, {
			data: { name: "Alice" },
			validate: { sup: true },
		});

		expect(resultPartial.isSubset).toBe(true);
		expect(resultFull.isSubset).toBe(true);
		expect(resultPartial.errors).toHaveLength(0);
		expect(resultFull.errors).toHaveLength(0);
	});

	test("partial mode still checks value constraints (minLength, pattern, etc.)", async () => {
		const schema: JSONSchema7 = {
			type: "object",
			properties: {
				email: { type: "string", format: "email" },
				code: { type: "string", pattern: "^[A-Z]{3}$" },
			},
			required: ["email", "code"],
		};

		const result = await checker.check(schema, schema, {
			data: { code: "abc" },
			validate: { sup: { partial: true } },
		});

		expect(result.isSubset).toBe(false);
		const patternError = result.errors.find((e) => e.key.includes("code"));
		expect(patternError).toBeDefined();

		// No required error for email
		const emailError = result.errors.find(
			(e) => e.key.includes("email") && e.received === "undefined",
		);
		expect(emailError).toBeUndefined();
	});

	test("static incompatibility is reported even with partial mode", async () => {
		const sub: JSONSchema7 = { type: "string" };
		const sup: JSONSchema7 = { type: "number" };

		const result = await checker.check(sub, sup, {
			data: "hello",
			validate: { sup: { partial: true } },
		});

		// Static check fails (string ⊄ number) before runtime validation
		expect(result.isSubset).toBe(false);
		expect(result.errors.length).toBeGreaterThanOrEqual(1);
	});

	test("partial: true in object form is equivalent to enabling the target", async () => {
		const schema: JSONSchema7 = {
			type: "object",
			properties: {
				value: { type: "string", minLength: 5 },
			},
			required: ["value"],
		};

		// { partial: true } should enable validation AND partial mode
		const result = await checker.check(schema, schema, {
			data: { value: "hi" },
			validate: { sup: { partial: true } },
		});

		expect(result.isSubset).toBe(false);
		// Should get minLength error, not required error
		const minLengthError = result.errors.find(
			(e) => e.key.includes("value") && e.expected.includes("minLength"),
		);
		expect(minLengthError).toBeDefined();
	});

	test("partial mode with array items validates present items", async () => {
		const schema: JSONSchema7 = {
			type: "object",
			properties: {
				tags: {
					type: "array",
					items: {
						type: "object",
						properties: {
							id: { type: "number" },
							label: { type: "string" },
						},
						required: ["id", "label"],
					},
					minItems: 2,
				},
				name: { type: "string" },
			},
			required: ["tags", "name"],
		};

		// Provide only tags with partial item data
		// minItems is NOT stripped (only required and additionalProperties are)
		// but the nested object required IS stripped in partial mode
		const result = await checker.check(schema, schema, {
			data: { tags: [{ id: "not_a_number" }] },
			validate: { sup: { partial: true } },
		});

		expect(result.isSubset).toBe(false);

		// Should get type error for id being a string instead of number
		const idError = result.errors.find((e) => e.key.includes("id"));
		expect(idError).toBeDefined();

		// Should NOT get required error for missing name at root
		const nameError = result.errors.find(
			(e) =>
				e.key.includes("name") &&
				!e.key.includes("propertyNames") &&
				e.received === "undefined",
		);
		expect(nameError).toBeUndefined();
	});

	test("partial mode with boolean schema (true) → no errors", async () => {
		const result = await checker.check(true, true, {
			data: { anything: "goes" },
			validate: { sup: { partial: true } },
		});

		expect(result.isSubset).toBe(true);
		expect(result.errors).toHaveLength(0);
	});
});

// ── Backward compatibility ───────────────────────────────────────────────────

describe("partial validation — backward compatibility", () => {
	let checker: JsonSchemaCompatibilityChecker;

	beforeAll(() => {
		checker = new JsonSchemaCompatibilityChecker();
	});

	test("validate: true still works (no partial)", async () => {
		const result = await checker.check(objectWithRequired, objectWithRequired, {
			data: { accountId: "salut" },
			validate: true,
		});

		expect(result.isSubset).toBe(false);
		// Should have required errors
		expect(result.errors.length).toBeGreaterThanOrEqual(2);
	});

	test("validate: { sup: true } still works (no partial)", async () => {
		const result = await checker.check(objectWithRequired, objectWithRequired, {
			data: { accountId: "salut" },
			validate: { sup: true },
		});

		expect(result.isSubset).toBe(false);
		const supErrors = result.errors.filter((e) => e.key.startsWith("$sup"));
		expect(supErrors.length).toBeGreaterThanOrEqual(2);
	});

	test("validate: false still works (no validation)", async () => {
		const result = await checker.check(objectWithRequired, objectWithRequired, {
			data: { accountId: "salut" },
			validate: false,
		});

		expect(result.isSubset).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	test("validate: { sub: false, sup: false } still works", async () => {
		const result = await checker.check(objectWithRequired, objectWithRequired, {
			data: { accountId: "salut" },
			validate: { sub: false, sup: false },
		});

		expect(result.isSubset).toBe(true);
		expect(result.errors).toHaveLength(0);
	});
});

// ── Branching schemas (oneOf/anyOf) with partial ─────────────────────────────

describe("partial validation — branching schemas", () => {
	let checker: JsonSchemaCompatibilityChecker;

	beforeAll(() => {
		checker = new JsonSchemaCompatibilityChecker();
	});

	test("schema with anyOf branches — partial strips required from all branches", async () => {
		const schema: JSONSchema7 = {
			type: "object",
			properties: {
				kind: { type: "string", enum: ["text", "number"] },
			},
			required: ["kind"],
			anyOf: [
				{
					type: "object",
					properties: {
						kind: { type: "string", const: "text" },
						value: { type: "string" },
					},
					required: ["kind", "value"],
				},
				{
					type: "object",
					properties: {
						kind: { type: "string", const: "number" },
						value: { type: "number" },
					},
					required: ["kind", "value"],
				},
			],
		};

		// Providing only kind — partial mode should not enforce required value
		const result = await checker.check(schema, schema, {
			data: { kind: "text" },
			validate: { sup: { partial: true } },
		});

		// No required errors expected
		const requiredErrors = result.errors.filter(
			(e) => e.received === "undefined",
		);
		expect(requiredErrors).toHaveLength(0);
	});
});

// ── Conditional schemas (if/then/else) with partial ──────────────────────────

describe("partial validation — conditional schemas", () => {
	let checker: JsonSchemaCompatibilityChecker;

	beforeAll(() => {
		checker = new JsonSchemaCompatibilityChecker();
	});

	test("schema with if/then/else — partial strips required from branches", async () => {
		const schema: JSONSchema7 = {
			type: "object",
			properties: {
				kind: { type: "string", enum: ["text", "number"] },
				textValue: { type: "string" },
				numValue: { type: "number" },
			},
			required: ["kind"],
			if: {
				properties: { kind: { const: "text" } },
				required: ["kind"],
			},
			then: {
				required: ["textValue"],
			},
			else: {
				required: ["numValue"],
			},
		};

		// Provide only kind = "text" — then branch adds required textValue
		// but partial mode should skip it
		const result = await checker.check(schema, schema, {
			data: { kind: "text" },
			validate: { sup: { partial: true } },
		});

		const requiredErrors = result.errors.filter(
			(e) => e.received === "undefined",
		);
		expect(requiredErrors).toHaveLength(0);
	});
});
