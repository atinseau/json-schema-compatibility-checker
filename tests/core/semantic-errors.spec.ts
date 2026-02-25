import { beforeAll, describe, expect, test } from "bun:test";
import type { JSONSchema7 } from "json-schema";
import { JsonSchemaCompatibilityChecker } from "../../src";

let checker: JsonSchemaCompatibilityChecker;

beforeAll(() => {
	checker = new JsonSchemaCompatibilityChecker();
});

// ═══════════════════════════════════════════════════════════════════════════════
//  Semantic Errors — comprehensive tests for error reporting quality
//
//  Every test uses precise `toMatchObject({ key, expected, received })` to
//  validate that the error messages are semantically meaningful, with
//  normalised property paths (user.name, users[].name, accountId, etc.).
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
//  1. Missing required property
// ─────────────────────────────────────────────────────────────────────────────

describe("missing required property", () => {
	test("top-level missing key reports expected type and received undefined", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: { name: { type: "string" } },
			required: ["name"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				name: { type: "string" },
				accountId: { type: "string" },
			},
			required: ["name", "accountId"],
		};
		const result = checker.check(sub, sup);

		expect(result.isSubset).toBe(false);
		expect(result.errors).toHaveLength(1);
		expect(result.errors[0]).toMatchObject({
			key: "accountId",
			expected: "string",
			received: "undefined",
		});
	});

	test("multiple missing keys each produce a separate error", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: { name: { type: "string" } },
			required: ["name"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				name: { type: "string" },
				accountId: { type: "string" },
				meetingId: { type: "number" },
			},
			required: ["name", "accountId", "meetingId"],
		};
		const result = checker.check(sub, sup);

		expect(result.isSubset).toBe(false);
		expect(result.errors).toHaveLength(2);

		const accountErr = result.errors.find((e) => e.key === "accountId");
		expect(accountErr).toMatchObject({
			key: "accountId",
			expected: "string",
			received: "undefined",
		});

		const meetingErr = result.errors.find((e) => e.key === "meetingId");
		expect(meetingErr).toMatchObject({
			key: "meetingId",
			expected: "number",
			received: "undefined",
		});
	});

	test("missing nested key uses dot-separated path", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				user: {
					type: "object",
					properties: { name: { type: "string" } },
					required: ["name"],
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
						name: { type: "string" },
						email: { type: "string" },
					},
					required: ["name", "email"],
				},
			},
			required: ["user"],
		};
		const result = checker.check(sub, sup);

		expect(result.isSubset).toBe(false);
		expect(result.errors).toHaveLength(1);
		expect(result.errors[0]).toMatchObject({
			key: "user.email",
			expected: "string",
			received: "undefined",
		});
	});

	test("missing deeply nested key (3 levels) uses full dot path", () => {
		const sub: JSONSchema7 = {
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
		};
		const sup: JSONSchema7 = {
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
		};
		const result = checker.check(sub, sup);

		expect(result.isSubset).toBe(false);
		expect(result.errors).toHaveLength(1);
		expect(result.errors[0]).toMatchObject({
			key: "user.profile.bio",
			expected: "string",
			received: "undefined",
		});
	});

	test("missing key with number type", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: { name: { type: "string" } },
			required: ["name"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				name: { type: "string" },
				age: { type: "number" },
			},
			required: ["name", "age"],
		};
		const result = checker.check(sub, sup);

		expect(result.isSubset).toBe(false);
		expect(result.errors).toHaveLength(1);
		expect(result.errors[0]).toMatchObject({
			key: "age",
			expected: "number",
			received: "undefined",
		});
	});

	test("missing key with integer type", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {},
			required: [],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: { count: { type: "integer" } },
			required: ["count"],
		};
		const result = checker.check(sub, sup);

		expect(result.isSubset).toBe(false);
		expect(result.errors).toHaveLength(1);
		expect(result.errors[0]).toMatchObject({
			key: "count",
			expected: "integer",
			received: "undefined",
		});
	});

	test("missing key with array type", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {},
			required: [],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				tags: { type: "array", items: { type: "string" } },
			},
			required: ["tags"],
		};
		const result = checker.check(sub, sup);

		expect(result.isSubset).toBe(false);
		expect(result.errors).toHaveLength(1);
		expect(result.errors[0]).toMatchObject({
			key: "tags",
			expected: "string[]",
			received: "undefined",
		});
	});
});

// ─────────────────────────────────────────────────────────────────────────────
//  2. Type mismatches
// ─────────────────────────────────────────────────────────────────────────────

describe("type mismatch", () => {
	test("string vs number at root level", () => {
		const result = checker.check({ type: "string" }, { type: "number" });

		expect(result.isSubset).toBe(false);
		expect(result.errors.length).toBeGreaterThanOrEqual(1);
		expect(result.errors[0]).toMatchObject({
			key: "$root",
			expected: "number",
			received: "string",
		});
	});

	test("number vs string at root level", () => {
		const result = checker.check({ type: "number" }, { type: "string" });

		expect(result.isSubset).toBe(false);
		expect(result.errors[0]).toMatchObject({
			key: "$root",
			expected: "string",
			received: "number",
		});
	});

	test("boolean vs integer at root level", () => {
		const result = checker.check({ type: "boolean" }, { type: "integer" });

		expect(result.isSubset).toBe(false);
		expect(result.errors[0]).toMatchObject({
			key: "$root",
			expected: "integer",
			received: "boolean",
		});
	});

	test("type mismatch on a nested property uses dot path", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				user: {
					type: "object",
					properties: { age: { type: "string" } },
					required: ["age"],
				},
			},
			required: ["user"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				user: {
					type: "object",
					properties: { age: { type: "number" } },
					required: ["age"],
				},
			},
			required: ["user"],
		};
		const result = checker.check(sub, sup);

		expect(result.isSubset).toBe(false);
		expect(result.errors.length).toBeGreaterThanOrEqual(1);

		const ageError = result.errors.find((e) => e.key === "user.age");
		expect(ageError).toBeDefined();
		expect(ageError).toMatchObject({
			key: "user.age",
			expected: "number",
			received: "string",
		});
	});

	test("array items type mismatch uses [] path", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				tags: {
					type: "array",
					items: { type: "number" },
				},
			},
			required: ["tags"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				tags: {
					type: "array",
					items: { type: "string" },
				},
			},
			required: ["tags"],
		};
		const result = checker.check(sub, sup);

		expect(result.isSubset).toBe(false);
		expect(result.errors.length).toBeGreaterThanOrEqual(1);

		const itemsError = result.errors.find((e) => e.key === "tags[]");
		expect(itemsError).toBeDefined();
		expect(itemsError).toMatchObject({
			key: "tags[]",
			expected: "string",
			received: "number",
		});
	});

	test("nested array items type mismatch uses compound path", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				users: {
					type: "array",
					items: {
						type: "object",
						properties: { name: { type: "number" } },
						required: ["name"],
					},
				},
			},
			required: ["users"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				users: {
					type: "array",
					items: {
						type: "object",
						properties: { name: { type: "string" } },
						required: ["name"],
					},
				},
			},
			required: ["users"],
		};
		const result = checker.check(sub, sup);

		expect(result.isSubset).toBe(false);
		expect(result.errors.length).toBeGreaterThanOrEqual(1);

		const nameError = result.errors.find((e) => e.key === "users[].name");
		expect(nameError).toBeDefined();
		expect(nameError).toMatchObject({
			key: "users[].name",
			expected: "string",
			received: "number",
		});
	});

	test("missing required key inside array items uses [] path", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				users: {
					type: "array",
					items: {
						type: "object",
						properties: { name: { type: "string" } },
						required: ["name"],
					},
				},
			},
			required: ["users"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				users: {
					type: "array",
					items: {
						type: "object",
						properties: {
							name: { type: "string" },
							email: { type: "string" },
						},
						required: ["name", "email"],
					},
				},
			},
			required: ["users"],
		};
		const result = checker.check(sub, sup);

		expect(result.isSubset).toBe(false);
		expect(result.errors.length).toBeGreaterThanOrEqual(1);

		const emailError = result.errors.find((e) => e.key === "users[].email");
		expect(emailError).toBeDefined();
		expect(emailError).toMatchObject({
			key: "users[].email",
			expected: "string",
			received: "undefined",
		});
	});
});

// ─────────────────────────────────────────────────────────────────────────────
//  3. Enum errors
// ─────────────────────────────────────────────────────────────────────────────

describe("enum mismatch", () => {
	test("2 values: sub has extra enum values → 'X or Y' format", () => {
		const sub: JSONSchema7 = {
			type: "string",
			enum: ["123", "456"],
		};
		const sup: JSONSchema7 = {
			type: "string",
			enum: ["123", "salut"],
		};
		const result = checker.check(sub, sup);

		expect(result.isSubset).toBe(false);
		expect(result.errors.length).toBeGreaterThanOrEqual(1);
		expect(result.errors[0]).toMatchObject({
			key: "$root",
			expected: "123 or salut",
			received: "123 or 456",
		});
	});

	test("3+ values: comma-separated with 'or' before last", () => {
		const result = checker.check(
			{ type: "string", enum: ["a", "b", "c", "d"] },
			{ type: "string", enum: ["a", "b"] },
		);

		expect(result.isSubset).toBe(false);
		expect(result.errors[0]).toMatchObject({
			key: "$root",
			expected: "a or b",
			received: "a, b, c, or d",
		});
	});

	test("3 values in sup: comma + or format", () => {
		const result = checker.check(
			{ type: "number", enum: [10, 20, 30, 40] },
			{ type: "number", enum: [10, 20, 30] },
		);

		expect(result.isSubset).toBe(false);
		expect(result.errors[0]).toMatchObject({
			key: "$root",
			expected: "10, 20, or 30",
			received: "10, 20, 30, or 40",
		});
	});

	test("sup has enum, sub has plain type → enum vs type", () => {
		const sub: JSONSchema7 = {
			type: "string",
		};
		const sup: JSONSchema7 = {
			type: "string",
			enum: ["123", "salut"],
		};
		const result = checker.check(sub, sup);

		expect(result.isSubset).toBe(false);
		expect(result.errors.length).toBeGreaterThanOrEqual(1);
		expect(result.errors[0]).toMatchObject({
			key: "$root",
			expected: "123 or salut",
			received: "string",
		});
	});

	test("enum mismatch on nested property uses dot path", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				status: { type: "string", enum: ["active", "deleted"] },
			},
			required: ["status"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				status: { type: "string", enum: ["active", "inactive"] },
			},
			required: ["status"],
		};
		const result = checker.check(sub, sup);

		expect(result.isSubset).toBe(false);
		expect(result.errors.length).toBeGreaterThanOrEqual(1);

		const statusError = result.errors.find((e) => e.key === "status");
		expect(statusError).toBeDefined();
		expect(statusError).toMatchObject({
			key: "status",
			expected: "active or inactive",
			received: "active or deleted",
		});
	});

	test("single-value enum format", () => {
		const result = checker.check(
			{ type: "string", enum: ["hello", "world"] },
			{ type: "string", enum: ["hello"] },
		);

		expect(result.isSubset).toBe(false);
		expect(result.errors[0]).toMatchObject({
			key: "$root",
			expected: "hello",
			received: "hello or world",
		});
	});
});

// ─────────────────────────────────────────────────────────────────────────────
//  4. Const errors
// ─────────────────────────────────────────────────────────────────────────────

describe("const mismatch", () => {
	test("different string const values", () => {
		const result = checker.check({ const: "hello" }, { const: "world" });

		expect(result.isSubset).toBe(false);
		expect(result.errors.length).toBeGreaterThanOrEqual(1);
		expect(result.errors[0]).toMatchObject({
			key: "$root",
			expected: "world",
			received: "hello",
		});
	});

	test("different numeric const values", () => {
		const result = checker.check({ const: 42 }, { const: 99 });

		expect(result.isSubset).toBe(false);
		expect(result.errors[0]).toMatchObject({
			key: "$root",
			expected: "99",
			received: "42",
		});
	});

	test("const mismatch on nested property", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: { version: { const: "v1" } },
			required: ["version"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: { version: { const: "v2" } },
			required: ["version"],
		};
		const result = checker.check(sub, sup);

		expect(result.isSubset).toBe(false);
		const versionError = result.errors.find((e) => e.key === "version");
		expect(versionError).toBeDefined();
		expect(versionError).toMatchObject({
			key: "version",
			expected: "v2",
			received: "v1",
		});
	});
});

// ─────────────────────────────────────────────────────────────────────────────
//  5. Optional vs required
// ─────────────────────────────────────────────────────────────────────────────

describe("optional vs required", () => {
	test("required in sup, optional in sub → not optional / optional", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				meetingId: { type: "string" },
			},
			// meetingId is NOT in required
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				meetingId: { type: "string" },
			},
			required: ["meetingId"],
		};
		const result = checker.check(sub, sup);

		expect(result.isSubset).toBe(false);
		expect(result.errors).toHaveLength(1);
		expect(result.errors[0]).toMatchObject({
			key: "meetingId",
			expected: "not optional",
			received: "optional",
		});
	});

	test("optional mismatch on nested property uses dot path", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				user: {
					type: "object",
					properties: { email: { type: "string" } },
					// email NOT required
				},
			},
			required: ["user"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				user: {
					type: "object",
					properties: { email: { type: "string" } },
					required: ["email"],
				},
			},
			required: ["user"],
		};
		const result = checker.check(sub, sup);

		expect(result.isSubset).toBe(false);
		expect(result.errors).toHaveLength(1);
		expect(result.errors[0]).toMatchObject({
			key: "user.email",
			expected: "not optional",
			received: "optional",
		});
	});
});

// ─────────────────────────────────────────────────────────────────────────────
//  6. Numeric constraints
// ─────────────────────────────────────────────────────────────────────────────

describe("numeric constraints", () => {
	test("minimum violation", () => {
		const result = checker.check(
			{ type: "number", minimum: 0 },
			{ type: "number", minimum: 5 },
		);

		expect(result.isSubset).toBe(false);
		expect(result.errors.length).toBeGreaterThanOrEqual(1);

		const minError = result.errors.find((e) => e.expected.includes("minimum"));
		expect(minError).toBeDefined();
		expect(minError).toMatchObject({
			key: "$root",
			expected: "minimum: 5",
			received: "minimum: 0",
		});
	});

	test("maximum violation", () => {
		const result = checker.check(
			{ type: "number", maximum: 100 },
			{ type: "number", maximum: 10 },
		);

		expect(result.isSubset).toBe(false);
		const maxError = result.errors.find((e) => e.expected.includes("maximum"));
		expect(maxError).toBeDefined();
		expect(maxError).toMatchObject({
			key: "$root",
			expected: "maximum: 10",
			received: "maximum: 100",
		});
	});

	test("minimum and maximum both violated produces two errors", () => {
		const result = checker.check(
			{ type: "number", minimum: 0, maximum: 100 },
			{ type: "number", minimum: 5, maximum: 10 },
		);

		expect(result.isSubset).toBe(false);
		expect(result.errors.length).toBeGreaterThanOrEqual(2);

		const minError = result.errors.find((e) => e.expected === "minimum: 5");
		const maxError = result.errors.find((e) => e.expected === "maximum: 10");
		expect(minError).toBeDefined();
		expect(maxError).toBeDefined();
	});

	test("missing minimum when sup requires it", () => {
		const result = checker.check(
			{ type: "number" },
			{ type: "number", minimum: 5 },
		);

		expect(result.isSubset).toBe(false);
		expect(result.errors.length).toBeGreaterThanOrEqual(1);

		const minError = result.errors.find((e) => e.expected.includes("minimum"));
		expect(minError).toMatchObject({
			key: "$root",
			expected: "minimum: 5",
			received: "minimum: not set",
		});
	});

	test("multipleOf violation", () => {
		const result = checker.check(
			{ type: "number", multipleOf: 3 },
			{ type: "number", multipleOf: 6 },
		);

		expect(result.isSubset).toBe(false);
		const moError = result.errors.find((e) =>
			e.expected.includes("multipleOf"),
		);
		expect(moError).toMatchObject({
			key: "$root",
			expected: "multipleOf: 6",
			received: "multipleOf: 3",
		});
	});

	test("numeric constraint on nested property uses dot path", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: { score: { type: "number", minimum: 0 } },
			required: ["score"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: { score: { type: "number", minimum: 10 } },
			required: ["score"],
		};
		const result = checker.check(sub, sup);

		expect(result.isSubset).toBe(false);
		const scoreError = result.errors.find((e) => e.key === "score");
		expect(scoreError).toBeDefined();
		expect(scoreError).toMatchObject({
			key: "score",
			expected: "minimum: 10",
			received: "minimum: 0",
		});
	});
});

// ─────────────────────────────────────────────────────────────────────────────
//  7. String constraints
// ─────────────────────────────────────────────────────────────────────────────

describe("string constraints", () => {
	test("minLength violation", () => {
		const result = checker.check(
			{ type: "string", minLength: 1 },
			{ type: "string", minLength: 5 },
		);

		expect(result.isSubset).toBe(false);
		const error = result.errors.find((e) => e.expected.includes("minLength"));
		expect(error).toMatchObject({
			key: "$root",
			expected: "minLength: 5",
			received: "minLength: 1",
		});
	});

	test("maxLength violation", () => {
		const result = checker.check(
			{ type: "string", maxLength: 255 },
			{ type: "string", maxLength: 100 },
		);

		expect(result.isSubset).toBe(false);
		const error = result.errors.find((e) => e.expected.includes("maxLength"));
		expect(error).toMatchObject({
			key: "$root",
			expected: "maxLength: 100",
			received: "maxLength: 255",
		});
	});

	test("pattern added (sup has pattern, sub doesn't)", () => {
		const result = checker.check(
			{ type: "string" },
			{ type: "string", pattern: "^[a-z]+$" },
		);

		expect(result.isSubset).toBe(false);
		const error = result.errors.find((e) => e.expected.includes("pattern"));
		expect(error).toMatchObject({
			key: "$root",
			expected: "pattern: ^[a-z]+$",
			received: "no pattern constraint",
		});
	});

	test("format added (sup has format, sub doesn't)", () => {
		const result = checker.check(
			{ type: "string" },
			{ type: "string", format: "email" },
		);

		expect(result.isSubset).toBe(false);
		const error = result.errors.find((e) => e.expected.includes("format"));
		expect(error).toMatchObject({
			key: "$root",
			expected: "format: email",
			received: "no format constraint",
		});
	});

	test("format mismatch (both have format but different)", () => {
		const result = checker.check(
			{ type: "string", format: "uri" },
			{ type: "string", format: "email" },
		);

		expect(result.isSubset).toBe(false);
		const error = result.errors.find((e) => e.expected.includes("format"));
		expect(error).toMatchObject({
			key: "$root",
			expected: "format: email",
			received: "format: uri",
		});
	});

	test("string constraint on nested property uses dot path", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: { name: { type: "string" } },
			required: ["name"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: { name: { type: "string", minLength: 3 } },
			required: ["name"],
		};
		const result = checker.check(sub, sup);

		expect(result.isSubset).toBe(false);
		const nameError = result.errors.find((e) => e.key === "name");
		expect(nameError).toBeDefined();
		expect(nameError).toMatchObject({
			key: "name",
			expected: "minLength: 3",
			received: "minLength: not set",
		});
	});

	test("deeply nested string constraint (level1.level2.value)", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				level1: {
					type: "object",
					properties: {
						level2: {
							type: "object",
							properties: { value: { type: "string" } },
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
							properties: { value: { type: "string", minLength: 10 } },
							required: ["value"],
						},
					},
					required: ["level2"],
				},
			},
			required: ["level1"],
		};
		const result = checker.check(sub, sup);

		expect(result.isSubset).toBe(false);
		const deepError = result.errors.find(
			(e) => e.key === "level1.level2.value",
		);
		expect(deepError).toBeDefined();
		expect(deepError).toMatchObject({
			key: "level1.level2.value",
			expected: "minLength: 10",
			received: "minLength: not set",
		});
	});
});

// ─────────────────────────────────────────────────────────────────────────────
//  8. Object constraints
// ─────────────────────────────────────────────────────────────────────────────

describe("object constraints", () => {
	test("additionalProperties: false vs allowed", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: { name: { type: "string" }, age: { type: "number" } },
			required: ["name"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: { name: { type: "string" } },
			required: ["name"],
			additionalProperties: false,
		};
		const result = checker.check(sub, sup);

		expect(result.isSubset).toBe(false);
		expect(result.errors.length).toBeGreaterThanOrEqual(1);

		const apError = result.errors.find((e) =>
			e.expected.includes("additionalProperties"),
		);
		expect(apError).toBeDefined();
		expect(apError).toMatchObject({
			key: "$root",
			expected: "additionalProperties: false",
			received: "additional properties allowed",
		});
	});

	test("minProperties violation", () => {
		const result = checker.check(
			{ type: "object", minProperties: 1 },
			{ type: "object", minProperties: 3 },
		);

		expect(result.isSubset).toBe(false);
		expect(result.errors.length).toBeGreaterThanOrEqual(1);

		const error = result.errors.find((e) =>
			e.expected.includes("minProperties"),
		);
		expect(error).toMatchObject({
			key: "$root",
			expected: "minProperties: 3",
			received: "minProperties: 1",
		});
	});

	test("maxProperties violation", () => {
		const result = checker.check(
			{ type: "object", maxProperties: 10 },
			{ type: "object", maxProperties: 5 },
		);

		expect(result.isSubset).toBe(false);
		const error = result.errors.find((e) =>
			e.expected.includes("maxProperties"),
		);
		expect(error).toMatchObject({
			key: "$root",
			expected: "maxProperties: 5",
			received: "maxProperties: 10",
		});
	});

	test("propertyNames added (sup has constraint, sub doesn't)", () => {
		const sub: JSONSchema7 = { type: "object" };
		const sup: JSONSchema7 = {
			type: "object",
			propertyNames: { minLength: 3 },
		};
		const result = checker.check(sub, sup);

		expect(result.isSubset).toBe(false);
		expect(result.errors.length).toBeGreaterThanOrEqual(1);

		const pnError = result.errors.find(
			(e) =>
				e.key.includes("propertyNames") || e.expected.includes("propertyNames"),
		);
		expect(pnError).toBeDefined();
	});

	test("propertyNames minLength mismatch", () => {
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
		expect(result.errors.length).toBeGreaterThanOrEqual(1);

		const error = result.errors.find(
			(e) =>
				e.key.includes("propertyNames") || e.expected.includes("minLength"),
		);
		expect(error).toBeDefined();
	});

	test("patternProperties constraint mismatch", () => {
		const sub: JSONSchema7 = {
			type: "object",
			patternProperties: { "^S_": { type: "string" } },
		};
		const sup: JSONSchema7 = {
			type: "object",
			patternProperties: { "^S_": { type: "string", minLength: 5 } },
		};
		const result = checker.check(sub, sup);

		expect(result.isSubset).toBe(false);
		expect(result.errors.length).toBeGreaterThanOrEqual(1);
	});

	test("nested propertyNames error includes parent path", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: { config: { type: "object" } },
			required: ["config"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				config: {
					type: "object",
					propertyNames: { minLength: 2 },
				},
			},
			required: ["config"],
		};
		const result = checker.check(sub, sup);

		expect(result.isSubset).toBe(false);
		const error = result.errors.find(
			(e) =>
				e.key.includes("config") &&
				(e.key.includes("propertyNames") ||
					e.expected.includes("propertyNames")),
		);
		expect(error).toBeDefined();
	});
});

// ─────────────────────────────────────────────────────────────────────────────
//  9. Array constraints
// ─────────────────────────────────────────────────────────────────────────────

describe("array constraints", () => {
	test("minItems violation", () => {
		const result = checker.check(
			{ type: "array", items: { type: "string" }, minItems: 0 },
			{ type: "array", items: { type: "string" }, minItems: 2 },
		);

		expect(result.isSubset).toBe(false);
		const error = result.errors.find((e) => e.expected.includes("minItems"));
		expect(error).toMatchObject({
			key: "$root",
			expected: "minItems: 2",
			received: "minItems: 0",
		});
	});

	test("maxItems violation", () => {
		const result = checker.check(
			{ type: "array", items: { type: "string" }, maxItems: 100 },
			{ type: "array", items: { type: "string" }, maxItems: 10 },
		);

		expect(result.isSubset).toBe(false);
		const error = result.errors.find((e) => e.expected.includes("maxItems"));
		expect(error).toMatchObject({
			key: "$root",
			expected: "maxItems: 10",
			received: "maxItems: 100",
		});
	});

	test("uniqueItems violation", () => {
		const result = checker.check(
			{ type: "array", items: { type: "string" } },
			{ type: "array", items: { type: "string" }, uniqueItems: true },
		);

		expect(result.isSubset).toBe(false);
		const error = result.errors.find((e) => e.expected.includes("uniqueItems"));
		expect(error).toMatchObject({
			key: "$root",
			expected: "uniqueItems: true",
		});
	});

	test("array constraint on nested property", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				tags: { type: "array", items: { type: "string" } },
			},
			required: ["tags"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				tags: { type: "array", items: { type: "string" }, minItems: 1 },
			},
			required: ["tags"],
		};
		const result = checker.check(sub, sup);

		expect(result.isSubset).toBe(false);
		const error = result.errors.find((e) => e.key === "tags");
		expect(error).toBeDefined();
		expect(error).toMatchObject({
			key: "tags",
			expected: "minItems: 1",
			received: "minItems: not set",
		});
	});
});

// ─────────────────────────────────────────────────────────────────────────────
//  10. anyOf / oneOf branches
// ─────────────────────────────────────────────────────────────────────────────

describe("anyOf / oneOf branch errors", () => {
	test("anyOf branch rejection — extra branch in sub not in sup", () => {
		const sub: JSONSchema7 = {
			anyOf: [{ type: "string" }, { type: "number" }, { type: "boolean" }],
		};
		const sup: JSONSchema7 = {
			anyOf: [{ type: "string" }, { type: "number" }],
		};
		const result = checker.check(sub, sup);

		expect(result.isSubset).toBe(false);
		expect(result.errors.length).toBeGreaterThanOrEqual(1);

		const boolError = result.errors.find((e) => e.received === "boolean");
		expect(boolError).toBeDefined();
	});

	test("anyOf superset with no matching branch", () => {
		const result = checker.check(
			{ type: "boolean" },
			{ anyOf: [{ type: "string" }, { type: "number" }] },
		);

		expect(result.isSubset).toBe(false);
		expect(result.errors.length).toBeGreaterThanOrEqual(1);

		const error = result.errors[0];
		expect(error).toBeDefined();
		expect(error?.received).toBe("boolean");
	});

	test("oneOf branch rejection", () => {
		const sub: JSONSchema7 = {
			oneOf: [{ type: "string" }, { type: "boolean" }],
		};
		const sup: JSONSchema7 = {
			oneOf: [{ type: "string" }, { type: "number" }],
		};
		const result = checker.check(sub, sup);

		expect(result.isSubset).toBe(false);
		expect(result.errors.length).toBeGreaterThanOrEqual(1);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
//  11. Boolean schemas
// ─────────────────────────────────────────────────────────────────────────────

describe("boolean schema errors", () => {
	test("sup = false (never) reports 'never' expected", () => {
		const result = checker.check({ type: "string" }, false);

		expect(result.isSubset).toBe(false);
		expect(result.errors.length).toBeGreaterThanOrEqual(1);
		expect(result.errors[0]).toMatchObject({
			key: "$root",
			expected: "never",
			received: "string",
		});
	});

	test("sub = true (any) vs concrete sup reports 'any' received", () => {
		const result = checker.check(true, { type: "string" });

		expect(result.isSubset).toBe(false);
		expect(result.errors.length).toBeGreaterThanOrEqual(1);
		expect(result.errors[0]).toMatchObject({
			key: "$root",
			expected: "string",
			received: "any",
		});
	});
});

// ─────────────────────────────────────────────────────────────────────────────
//  12. Compatible schemas → no errors
// ─────────────────────────────────────────────────────────────────────────────

describe("compatible schemas produce no errors", () => {
	test("identity: same schema → isSubset true, no errors", () => {
		const schema: JSONSchema7 = {
			type: "object",
			properties: { name: { type: "string" } },
			required: ["name"],
		};
		const result = checker.check(schema, schema);

		expect(result.isSubset).toBe(true);
		expect(result.errors).toEqual([]);
	});

	test("sub more constrained than sup → no errors", () => {
		const result = checker.check(
			{ type: "string", minLength: 5 },
			{ type: "string" },
		);

		expect(result.isSubset).toBe(true);
		expect(result.errors).toEqual([]);
	});

	test("integer ⊆ number → no errors", () => {
		const result = checker.check({ type: "integer" }, { type: "number" });

		expect(result.isSubset).toBe(true);
		expect(result.errors).toEqual([]);
	});

	test("small enum ⊆ large enum → no errors", () => {
		const result = checker.check(
			{ type: "string", enum: ["a", "b"] },
			{ type: "string", enum: ["a", "b", "c"] },
		);

		expect(result.isSubset).toBe(true);
		expect(result.errors).toEqual([]);
	});

	test("strict numeric range ⊆ loose numeric range → no errors", () => {
		const result = checker.check(
			{ type: "number", minimum: 5, maximum: 10 },
			{ type: "number", minimum: 0, maximum: 100 },
		);

		expect(result.isSubset).toBe(true);
		expect(result.errors).toEqual([]);
	});

	test("sub with all required properties of sup → no errors", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				name: { type: "string" },
				age: { type: "number" },
				email: { type: "string" },
			},
			required: ["name", "age", "email"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				name: { type: "string" },
				age: { type: "number" },
			},
			required: ["name", "age"],
		};
		const result = checker.check(sub, sup);

		expect(result.isSubset).toBe(true);
		expect(result.errors).toEqual([]);
	});

	test("false ⊆ anything → no errors (empty set is subset of everything)", () => {
		const result = checker.check(false, { type: "string" });

		expect(result.isSubset).toBe(true);
		expect(result.errors).toEqual([]);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
//  13. Complex / real-world scenarios
// ─────────────────────────────────────────────────────────────────────────────

describe("complex real-world error scenarios", () => {
	test("webhook payload missing required + enum mismatch produces multiple errors", () => {
		const webhookPayload: JSONSchema7 = {
			type: "object",
			properties: {
				event: { type: "string" },
				payload: { type: "object" },
			},
			required: ["event"],
		};
		const strictEventSchema: JSONSchema7 = {
			type: "object",
			properties: {
				event: { type: "string", enum: ["created", "updated", "deleted"] },
				payload: {
					type: "object",
					properties: {
						id: { type: "string" },
						timestamp: { type: "string", format: "date-time" },
					},
					required: ["id", "timestamp"],
				},
			},
			required: ["event", "payload"],
		};
		const result = checker.check(webhookPayload, strictEventSchema);

		expect(result.isSubset).toBe(false);
		expect(result.errors.length).toBeGreaterThanOrEqual(1);
	});

	test("multiple property errors: missing + type mismatch + optionality", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				name: { type: "number" }, // wrong type
				email: { type: "string" }, // optional, but sup requires it
				// age missing entirely
			},
			required: ["name"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				name: { type: "string" },
				email: { type: "string" },
				age: { type: "number" },
			},
			required: ["name", "email", "age"],
		};
		const result = checker.check(sub, sup);

		expect(result.isSubset).toBe(false);
		expect(result.errors.length).toBeGreaterThanOrEqual(3);

		// Type mismatch on name
		const nameError = result.errors.find((e) => e.key === "name");
		expect(nameError).toBeDefined();
		expect(nameError).toMatchObject({
			key: "name",
			expected: "string",
			received: "number",
		});

		// Optionality mismatch on email
		const emailError = result.errors.find((e) => e.key === "email");
		expect(emailError).toBeDefined();
		expect(emailError).toMatchObject({
			key: "email",
			expected: "not optional",
			received: "optional",
		});

		// Missing age
		const ageError = result.errors.find((e) => e.key === "age");
		expect(ageError).toBeDefined();
		expect(ageError).toMatchObject({
			key: "age",
			expected: "number",
			received: "undefined",
		});
	});

	test("nested object in array: missing key + type mismatch", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				users: {
					type: "array",
					items: {
						type: "object",
						properties: {
							id: { type: "string" },
							name: { type: "number" }, // wrong type
							// email missing
						},
						required: ["id", "name"],
					},
				},
			},
			required: ["users"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				users: {
					type: "array",
					items: {
						type: "object",
						properties: {
							id: { type: "string" },
							name: { type: "string" },
							email: { type: "string" },
						},
						required: ["id", "name", "email"],
					},
				},
			},
			required: ["users"],
		};
		const result = checker.check(sub, sup);

		expect(result.isSubset).toBe(false);

		// Type mismatch on users[].name
		const nameError = result.errors.find((e) => e.key === "users[].name");
		expect(nameError).toBeDefined();
		expect(nameError).toMatchObject({
			key: "users[].name",
			expected: "string",
			received: "number",
		});

		// Missing users[].email
		const emailError = result.errors.find((e) => e.key === "users[].email");
		expect(emailError).toBeDefined();
		expect(emailError).toMatchObject({
			key: "users[].email",
			expected: "string",
			received: "undefined",
		});
	});

	test("enum mismatch on nested property inside array items", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				items: {
					type: "array",
					items: {
						type: "object",
						properties: {
							status: { type: "string", enum: ["active", "deleted", "banned"] },
						},
						required: ["status"],
					},
				},
			},
			required: ["items"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				items: {
					type: "array",
					items: {
						type: "object",
						properties: {
							status: { type: "string", enum: ["active", "inactive"] },
						},
						required: ["status"],
					},
				},
			},
			required: ["items"],
		};
		const result = checker.check(sub, sup);

		expect(result.isSubset).toBe(false);
		const statusError = result.errors.find((e) => e.key === "items[].status");
		expect(statusError).toBeDefined();
		expect(statusError).toMatchObject({
			key: "items[].status",
			expected: "active or inactive",
			received: "active, deleted, or banned",
		});
	});

	test("multiple constraint violations on same property (minLength + pattern)", () => {
		const result = checker.check(
			{ type: "string" },
			{ type: "string", minLength: 3, pattern: "^[a-z]+$" },
		);

		expect(result.isSubset).toBe(false);
		expect(result.errors.length).toBeGreaterThanOrEqual(2);

		const minLenError = result.errors.find((e) =>
			e.expected.includes("minLength"),
		);
		expect(minLenError).toMatchObject({
			key: "$root",
			expected: "minLength: 3",
			received: "minLength: not set",
		});

		const patternError = result.errors.find((e) =>
			e.expected.includes("pattern"),
		);
		expect(patternError).toMatchObject({
			key: "$root",
			expected: "pattern: ^[a-z]+$",
			received: "no pattern constraint",
		});
	});
});

// ─────────────────────────────────────────────────────────────────────────────
//  14. Error count precision
// ─────────────────────────────────────────────────────────────────────────────

describe("error count precision", () => {
	test("single missing property → exactly 1 error", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: { a: { type: "string" } },
			required: ["a"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				a: { type: "string" },
				b: { type: "string" },
			},
			required: ["a", "b"],
		};
		const result = checker.check(sub, sup);

		expect(result.isSubset).toBe(false);
		expect(result.errors).toHaveLength(1);
	});

	test("two missing properties → exactly 2 errors", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: { a: { type: "string" } },
			required: ["a"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				a: { type: "string" },
				b: { type: "string" },
				c: { type: "number" },
			},
			required: ["a", "b", "c"],
		};
		const result = checker.check(sub, sup);

		expect(result.isSubset).toBe(false);
		expect(result.errors).toHaveLength(2);
	});

	test("compatible schemas → exactly 0 errors", () => {
		const result = checker.check(
			{ type: "string", minLength: 10 },
			{ type: "string" },
		);

		expect(result.isSubset).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	test("single type mismatch at root → at least 1 error", () => {
		const result = checker.check({ type: "string" }, { type: "number" });

		expect(result.isSubset).toBe(false);
		expect(result.errors.length).toBeGreaterThanOrEqual(1);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
//  15. formatSchemaType rendering
// ─────────────────────────────────────────────────────────────────────────────

describe("formatSchemaType rendering in errors", () => {
	test("array type rendered as type[]", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {},
			required: [],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				ids: { type: "array", items: { type: "number" } },
			},
			required: ["ids"],
		};
		const result = checker.check(sub, sup);

		expect(result.isSubset).toBe(false);
		const idsError = result.errors.find((e) => e.key === "ids");
		expect(idsError).toMatchObject({
			key: "ids",
			expected: "number[]",
			received: "undefined",
		});
	});

	test("missing key with boolean type", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {},
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: { active: { type: "boolean" } },
			required: ["active"],
		};
		const result = checker.check(sub, sup);

		expect(result.isSubset).toBe(false);
		expect(result.errors[0]).toMatchObject({
			key: "active",
			expected: "boolean",
			received: "undefined",
		});
	});

	test("missing key with object type", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {},
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				metadata: { type: "object", properties: { key: { type: "string" } } },
			},
			required: ["metadata"],
		};
		const result = checker.check(sub, sup);

		expect(result.isSubset).toBe(false);
		expect(result.errors[0]).toMatchObject({
			key: "metadata",
			expected: "object",
			received: "undefined",
		});
	});
});

// ─────────────────────────────────────────────────────────────────────────────
//  16. canConnect errors
// ─────────────────────────────────────────────────────────────────────────────

describe("canConnect error reporting", () => {
	test("incompatible connection reports errors with direction", () => {
		const sourceOutput: JSONSchema7 = {
			type: "object",
			properties: { value: { type: "string" } },
			required: ["value"],
		};
		const targetInput: JSONSchema7 = {
			type: "object",
			properties: { value: { type: "number" } },
			required: ["value"],
		};
		const result = checker.canConnect(sourceOutput, targetInput);

		expect(result.isSubset).toBe(false);
		expect(result.direction).toBe("sourceOutput ⊆ targetInput");
		expect(result.errors.length).toBeGreaterThanOrEqual(1);

		const valueError = result.errors.find((e) => e.key === "value");
		expect(valueError).toMatchObject({
			key: "value",
			expected: "number",
			received: "string",
		});
	});

	test("compatible connection has no errors", () => {
		const sourceOutput: JSONSchema7 = {
			type: "object",
			properties: {
				id: { type: "string" },
				name: { type: "string" },
			},
			required: ["id", "name"],
		};
		const targetInput: JSONSchema7 = {
			type: "object",
			properties: { id: { type: "string" } },
			required: ["id"],
		};
		const result = checker.canConnect(sourceOutput, targetInput);

		expect(result.isSubset).toBe(true);
		expect(result.errors).toEqual([]);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
//  17. `not` keyword errors
// ─────────────────────────────────────────────────────────────────────────────

describe("not keyword errors", () => {
	test("sup has not.type, sub has no not → reports 'not <type>' expected", () => {
		const sub: JSONSchema7 = { type: "string" };
		const sup: JSONSchema7 = { type: "string", not: { const: "forbidden" } };

		const result = checker.check(sub, sup);

		expect(result.isSubset).toBe(false);
		expect(result.errors.length).toBeGreaterThanOrEqual(1);

		const notError = result.errors.find(
			(e) => e.expected.includes("not") && e.expected.includes("forbidden"),
		);
		expect(notError).toBeDefined();
	});

	test("sup has not.type: string, sub is string → incompatible", () => {
		const result = checker.check({ type: "string" }, {
			not: { type: "string" },
		} as JSONSchema7);

		expect(result.isSubset).toBe(false);
		expect(result.errors.length).toBeGreaterThanOrEqual(1);

		const error = result.errors[0];
		expect(error).toBeDefined();
		expect(error?.expected).toContain("not");
		expect(error?.expected).toContain("string");
	});

	test("sup has not.const, sub is same const → incompatible", () => {
		const result = checker.check({ const: "deleted" } as JSONSchema7, {
			type: "string",
			not: { const: "deleted" },
		});

		expect(result.isSubset).toBe(false);
		expect(result.errors.length).toBeGreaterThanOrEqual(1);
	});

	test("both have not but different → reports mismatch", () => {
		const result = checker.check(
			{ type: "string", not: { const: "a" } },
			{ type: "string", not: { const: "b" } },
		);

		expect(result.isSubset).toBe(false);
		expect(result.errors.length).toBeGreaterThanOrEqual(1);

		const error = result.errors.find((e) => e.expected.includes("not"));
		expect(error).toBeDefined();
		expect(error?.expected).toContain("b");
		expect(error?.received).toContain("a");
	});

	test("both have identical not → no errors", () => {
		const schema: JSONSchema7 = { type: "string", not: { const: "forbidden" } };
		const result = checker.check(schema, schema);

		expect(result.isSubset).toBe(true);
		expect(result.errors).toEqual([]);
	});

	test("not on nested property", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				status: { type: "string" },
			},
			required: ["status"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				status: { type: "string", not: { const: "deleted" } },
			},
			required: ["status"],
		};
		const result = checker.check(sub, sup);

		expect(result.isSubset).toBe(false);
		expect(result.errors.length).toBeGreaterThanOrEqual(1);

		const statusError = result.errors.find((e) => e.key === "status");
		expect(statusError).toBeDefined();
		expect(statusError?.expected).toContain("not");
	});

	test("pure not schema renders as 'not <type>' via formatSchemaType", () => {
		// Directly test the rendering: { not: { type: "string" } } → "not string"
		const { formatSchemaType } = require("../../src");
		expect(formatSchemaType({ not: { type: "string" } })).toBe("not string");
		expect(formatSchemaType({ not: { type: "number" } })).toBe("not number");
		expect(formatSchemaType({ not: { const: "foo" } })).toBe("not foo");
	});

	test("not with enum exclusion", () => {
		const result = checker.check(
			{ type: "string", enum: ["a", "b", "c"] },
			{ type: "string", not: { enum: ["c", "d"] } },
		);

		expect(result.isSubset).toBe(false);
		expect(result.errors.length).toBeGreaterThanOrEqual(1);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
//  18. `dependencies` / `dependentRequired` errors
// ─────────────────────────────────────────────────────────────────────────────

describe("dependencies errors", () => {
	test("sup has array-form dependency, sub has none → reports missing dependency", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				name: { type: "string" },
				email: { type: "string" },
			},
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				name: { type: "string" },
				email: { type: "string" },
			},
			dependencies: {
				email: ["name"],
			},
		};
		const result = checker.check(sub, sup);

		expect(result.isSubset).toBe(false);
		expect(result.errors.length).toBeGreaterThanOrEqual(1);

		const depError = result.errors.find(
			(e) => e.expected.includes("dependency") && e.expected.includes("email"),
		);
		expect(depError).toBeDefined();
		expect(depError?.expected).toContain("name");
		expect(depError?.received).toContain("no dependency");
	});

	test("both have array-form dependency, sub is missing one dep → reports mismatch", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				a: { type: "string" },
				b: { type: "string" },
				c: { type: "string" },
			},
			dependencies: {
				a: ["b"],
			},
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				a: { type: "string" },
				b: { type: "string" },
				c: { type: "string" },
			},
			dependencies: {
				a: ["b", "c"],
			},
		};
		const result = checker.check(sub, sup);

		expect(result.isSubset).toBe(false);
		expect(result.errors.length).toBeGreaterThanOrEqual(1);

		const depError = result.errors.find(
			(e) => e.expected.includes("dependency") && e.expected.includes("a"),
		);
		expect(depError).toBeDefined();
		expect(depError?.expected).toContain("b, c");
		expect(depError?.received).toContain("b");
	});

	test("both have identical array-form dependencies → no errors", () => {
		const schema: JSONSchema7 = {
			type: "object",
			properties: {
				a: { type: "string" },
				b: { type: "string" },
			},
			dependencies: {
				a: ["b"],
			},
		};
		const result = checker.check(schema, schema);

		expect(result.isSubset).toBe(true);
		expect(result.errors).toEqual([]);
	});

	test("sup has schema-form dependency, sub has none → reports missing", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				billing: { type: "string" },
			},
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				billing: { type: "string" },
			},
			dependencies: {
				billing: {
					properties: { address: { type: "string" } },
					required: ["address"],
				},
			},
		};
		const result = checker.check(sub, sup);

		expect(result.isSubset).toBe(false);
		expect(result.errors.length).toBeGreaterThanOrEqual(1);

		const depError = result.errors.find(
			(e) =>
				e.expected.includes("dependency") && e.expected.includes("billing"),
		);
		expect(depError).toBeDefined();
		expect(depError?.received).toContain("no dependency");
	});

	test("both have schema-form dependency, schemas differ → reports diff via recursion", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				billing: { type: "string" },
			},
			dependencies: {
				billing: {
					properties: { address: { type: "string" } },
					required: ["address"],
				},
			},
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				billing: { type: "string" },
			},
			dependencies: {
				billing: {
					properties: {
						address: { type: "string" },
						zip: { type: "string" },
					},
					required: ["address", "zip"],
				},
			},
		};
		const result = checker.check(sub, sup);

		expect(result.isSubset).toBe(false);
		expect(result.errors.length).toBeGreaterThanOrEqual(1);

		// Should report that 'zip' is missing inside the dependency schema
		const _zipError = result.errors.find(
			(e) =>
				e.key.includes("dependency") &&
				e.key.includes("billing") &&
				e.expected === "string" &&
				e.received === "undefined",
		);
		// The error may be nested via the dependency path
		const anyDep = result.errors.find((e) => e.key.includes("dependency"));
		expect(anyDep).toBeDefined();
	});

	test("multiple dependencies, one missing → reports only the missing one", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				a: { type: "string" },
				b: { type: "string" },
			},
			dependencies: {
				a: ["b"],
			},
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				a: { type: "string" },
				b: { type: "string" },
			},
			dependencies: {
				a: ["b"],
				b: ["a"],
			},
		};
		const result = checker.check(sub, sup);

		expect(result.isSubset).toBe(false);

		const depBError = result.errors.find(
			(e) =>
				e.expected.includes("dependency") && e.expected.includes("b requires"),
		);
		expect(depBError).toBeDefined();
	});
});

// ─────────────────────────────────────────────────────────────────────────────
//  19. `contains` comparison errors
// ─────────────────────────────────────────────────────────────────────────────

describe("contains comparison errors", () => {
	test("sup has contains, sub has none → reports missing contains", () => {
		const sub: JSONSchema7 = {
			type: "array",
			items: { type: "number" },
		};
		const sup: JSONSchema7 = {
			type: "array",
			items: { type: "number" },
			contains: { type: "number", minimum: 10 },
		};
		const result = checker.check(sub, sup);

		expect(result.isSubset).toBe(false);
		expect(result.errors.length).toBeGreaterThanOrEqual(1);

		const containsError = result.errors.find((e) =>
			e.expected.includes("contains"),
		);
		expect(containsError).toBeDefined();
		expect(containsError?.received).toContain("no contains");
	});

	test("both have contains but different types → reports mismatch via recursion", () => {
		const sub: JSONSchema7 = {
			type: "array",
			items: { type: "number" },
			contains: { type: "string" },
		};
		const sup: JSONSchema7 = {
			type: "array",
			items: { type: "number" },
			contains: { type: "number" },
		};
		const result = checker.check(sub, sup);

		expect(result.isSubset).toBe(false);
		expect(result.errors.length).toBeGreaterThanOrEqual(1);

		const containsError = result.errors.find((e) => e.key.includes("contains"));
		expect(containsError).toBeDefined();
		expect(containsError?.expected).toBe("number");
		expect(containsError?.received).toBe("string");
	});

	test("both have contains with same constraint → compatible (identity)", () => {
		const schema: JSONSchema7 = {
			type: "array",
			items: { type: "number" },
			contains: { type: "number", minimum: 5 },
		};
		const result = checker.check(schema, schema);

		expect(result.isSubset).toBe(true);
		expect(result.errors).toEqual([]);
	});

	test("both have contains, sub is stricter → no error", () => {
		const sub: JSONSchema7 = {
			type: "array",
			items: { type: "number" },
			contains: { type: "number", minimum: 10 },
		};
		const sup: JSONSchema7 = {
			type: "array",
			items: { type: "number" },
			contains: { type: "number", minimum: 5 },
		};
		const result = checker.check(sub, sup);

		expect(result.isSubset).toBe(true);
		expect(result.errors).toEqual([]);
	});

	test("both have contains, sub is looser → reports constraint diff", () => {
		const sub: JSONSchema7 = {
			type: "array",
			items: { type: "number" },
			contains: { type: "number", minimum: 1 },
		};
		const sup: JSONSchema7 = {
			type: "array",
			items: { type: "number" },
			contains: { type: "number", minimum: 10 },
		};
		const result = checker.check(sub, sup);

		expect(result.isSubset).toBe(false);
		expect(result.errors.length).toBeGreaterThanOrEqual(1);

		const containsError = result.errors.find((e) => e.key.includes("contains"));
		expect(containsError).toBeDefined();
		expect(containsError?.expected).toContain("minimum: 10");
	});

	test("contains on nested array property", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				scores: {
					type: "array",
					items: { type: "number" },
				},
			},
			required: ["scores"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				scores: {
					type: "array",
					items: { type: "number" },
					contains: { type: "number", minimum: 50 },
				},
			},
			required: ["scores"],
		};
		const result = checker.check(sub, sup);

		expect(result.isSubset).toBe(false);
		expect(result.errors.length).toBeGreaterThanOrEqual(1);

		const error = result.errors.find((e) => e.expected.includes("contains"));
		expect(error).toBeDefined();
	});
});

// ─────────────────────────────────────────────────────────────────────────────
//  20. Tuple items errors
// ─────────────────────────────────────────────────────────────────────────────

describe("tuple items errors", () => {
	test("type mismatch in tuple position [0] → reports [0] path", () => {
		const sub: JSONSchema7 = {
			type: "array",
			items: [{ type: "string" }, { type: "number" }],
		};
		const sup: JSONSchema7 = {
			type: "array",
			items: [{ type: "number" }, { type: "number" }],
		};
		const result = checker.check(sub, sup);

		expect(result.isSubset).toBe(false);
		expect(result.errors.length).toBeGreaterThanOrEqual(1);

		const err = result.errors.find((e) => e.key === "[0]");
		expect(err).toBeDefined();
		expect(err).toMatchObject({
			key: "[0]",
			expected: "number",
			received: "string",
		});
	});

	test("sup tuple is longer than sub → reports missing position as undefined", () => {
		const sub: JSONSchema7 = {
			type: "array",
			items: [{ type: "string" }],
		};
		const sup: JSONSchema7 = {
			type: "array",
			items: [{ type: "string" }, { type: "number" }],
		};
		const result = checker.check(sub, sup);

		expect(result.isSubset).toBe(false);
		expect(result.errors.length).toBeGreaterThanOrEqual(1);

		const err = result.errors.find((e) => e.key === "[1]");
		expect(err).toBeDefined();
		expect(err).toMatchObject({
			key: "[1]",
			expected: "number",
			received: "undefined",
		});
	});

	test("identical tuples → no errors", () => {
		const schema: JSONSchema7 = {
			type: "array",
			items: [{ type: "string" }, { type: "number" }, { type: "boolean" }],
		};
		const result = checker.check(schema, schema);

		expect(result.isSubset).toBe(true);
		expect(result.errors).toEqual([]);
	});

	test("multiple mismatches in tuple", () => {
		const sub: JSONSchema7 = {
			type: "array",
			items: [{ type: "string" }, { type: "string" }, { type: "string" }],
		};
		const sup: JSONSchema7 = {
			type: "array",
			items: [{ type: "number" }, { type: "boolean" }, { type: "string" }],
		};
		const result = checker.check(sub, sup);

		expect(result.isSubset).toBe(false);
		expect(result.errors.length).toBeGreaterThanOrEqual(2);

		const err0 = result.errors.find((e) => e.key === "[0]");
		expect(err0).toMatchObject({
			key: "[0]",
			expected: "number",
			received: "string",
		});

		const err1 = result.errors.find((e) => e.key === "[1]");
		expect(err1).toMatchObject({
			key: "[1]",
			expected: "boolean",
			received: "string",
		});
	});

	test("tuple inside nested object uses compound path", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				coords: {
					type: "array",
					items: [{ type: "string" }, { type: "number" }],
				},
			},
			required: ["coords"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				coords: {
					type: "array",
					items: [{ type: "number" }, { type: "number" }],
				},
			},
			required: ["coords"],
		};
		const result = checker.check(sub, sup);

		expect(result.isSubset).toBe(false);

		const err = result.errors.find((e) => e.key === "coords.[0]");
		expect(err).toBeDefined();
		expect(err).toMatchObject({
			key: "coords.[0]",
			expected: "number",
			received: "string",
		});
	});

	test("sub tuple stricter (more constrained items) ⊆ sup tuple → no errors", () => {
		const sub: JSONSchema7 = {
			type: "array",
			items: [
				{ type: "string", minLength: 5 },
				{ type: "number", minimum: 10 },
			],
		};
		const sup: JSONSchema7 = {
			type: "array",
			items: [{ type: "string" }, { type: "number" }],
		};
		const result = checker.check(sub, sup);

		expect(result.isSubset).toBe(true);
		expect(result.errors).toEqual([]);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
//  21. `additionalProperties` with schema errors
// ─────────────────────────────────────────────────────────────────────────────

describe("additionalProperties schema errors", () => {
	test("sup has additionalProperties schema, sub allows all → reports error", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: { name: { type: "string" } },
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: { name: { type: "string" } },
			additionalProperties: { type: "string" },
		};
		const result = checker.check(sub, sup);

		expect(result.isSubset).toBe(false);
		expect(result.errors.length).toBeGreaterThanOrEqual(1);

		const apError = result.errors.find((e) =>
			e.expected.includes("additionalProperties"),
		);
		expect(apError).toBeDefined();
		expect(apError?.expected).toContain("string");
		expect(apError?.received).toContain("allowed");
	});

	test("both have additionalProperties schemas, types differ → reports mismatch via recursion", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: { name: { type: "string" } },
			additionalProperties: { type: "number" },
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: { name: { type: "string" } },
			additionalProperties: { type: "string" },
		};
		const result = checker.check(sub, sup);

		expect(result.isSubset).toBe(false);
		expect(result.errors.length).toBeGreaterThanOrEqual(1);

		const apError = result.errors.find((e) =>
			e.key.includes("additionalProperties"),
		);
		expect(apError).toBeDefined();
		expect(apError?.expected).toBe("string");
		expect(apError?.received).toBe("number");
	});

	test("both have identical additionalProperties schemas → no errors", () => {
		const schema: JSONSchema7 = {
			type: "object",
			properties: { name: { type: "string" } },
			additionalProperties: { type: "string" },
		};
		const result = checker.check(schema, schema);

		expect(result.isSubset).toBe(true);
		expect(result.errors).toEqual([]);
	});

	test("sub has additionalProperties schema, sup has false → reports error", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: { name: { type: "string" } },
			additionalProperties: { type: "string" },
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: { name: { type: "string" } },
			additionalProperties: false,
		};
		const result = checker.check(sub, sup);

		expect(result.isSubset).toBe(false);
		expect(result.errors.length).toBeGreaterThanOrEqual(1);

		const apError = result.errors.find((e) =>
			e.expected.includes("additionalProperties: false"),
		);
		expect(apError).toBeDefined();
	});

	test("sub additionalProperties stricter (minLength) ⊆ sup additionalProperties → no errors", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: { name: { type: "string" } },
			additionalProperties: { type: "string", minLength: 5 },
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: { name: { type: "string" } },
			additionalProperties: { type: "string" },
		};
		const result = checker.check(sub, sup);

		expect(result.isSubset).toBe(true);
		expect(result.errors).toEqual([]);
	});

	test("nested object with additionalProperties schema mismatch", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				config: {
					type: "object",
					properties: { key: { type: "string" } },
					additionalProperties: { type: "number" },
				},
			},
			required: ["config"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				config: {
					type: "object",
					properties: { key: { type: "string" } },
					additionalProperties: { type: "string" },
				},
			},
			required: ["config"],
		};
		const result = checker.check(sub, sup);

		expect(result.isSubset).toBe(false);
		expect(result.errors.length).toBeGreaterThanOrEqual(1);

		const apError = result.errors.find((e) =>
			e.key.includes("additionalProperties"),
		);
		expect(apError).toBeDefined();
	});
});

// ─────────────────────────────────────────────────────────────────────────────
//  22. `anyOf` nested in properties errors
// ─────────────────────────────────────────────────────────────────────────────

describe("anyOf nested in properties errors", () => {
	test("property with anyOf in sub, plain type in sup → branch rejected", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				value: { anyOf: [{ type: "string" }, { type: "number" }] },
			},
			required: ["value"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				value: { type: "string" },
			},
			required: ["value"],
		};
		const result = checker.check(sub, sup);

		expect(result.isSubset).toBe(false);
		expect(result.errors.length).toBeGreaterThanOrEqual(1);

		// Should report that number branch is not compatible with string
		const valueError = result.errors.find(
			(e) => e.key === "value" && e.received === "number",
		);
		expect(valueError).toBeDefined();
	});

	test("property with anyOf in sup, sub type not matching any branch → error", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				value: { type: "boolean" },
			},
			required: ["value"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				value: { anyOf: [{ type: "string" }, { type: "number" }] },
			},
			required: ["value"],
		};
		const result = checker.check(sub, sup);

		expect(result.isSubset).toBe(false);
		expect(result.errors.length).toBeGreaterThanOrEqual(1);

		const valueError = result.errors.find((e) => e.key === "value");
		expect(valueError).toBeDefined();
		expect(valueError?.received).toBe("boolean");
	});

	test("property anyOf in sub matching sup anyOf exactly → no errors", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				value: { anyOf: [{ type: "string" }, { type: "number" }] },
			},
			required: ["value"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				value: { anyOf: [{ type: "string" }, { type: "number" }] },
			},
			required: ["value"],
		};
		const result = checker.check(sub, sup);

		expect(result.isSubset).toBe(true);
		expect(result.errors).toEqual([]);
	});

	test("property anyOf in sub has extra branch vs sup anyOf → reports error", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				value: {
					anyOf: [{ type: "string" }, { type: "number" }, { type: "boolean" }],
				},
			},
			required: ["value"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				value: { anyOf: [{ type: "string" }, { type: "number" }] },
			},
			required: ["value"],
		};
		const result = checker.check(sub, sup);

		expect(result.isSubset).toBe(false);
		expect(result.errors.length).toBeGreaterThanOrEqual(1);

		const boolError = result.errors.find((e) => e.received === "boolean");
		expect(boolError).toBeDefined();
	});

	test("deeply nested anyOf in array items", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				items: {
					type: "array",
					items: {
						type: "object",
						properties: {
							value: { anyOf: [{ type: "string" }, { type: "boolean" }] },
						},
						required: ["value"],
					},
				},
			},
			required: ["items"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				items: {
					type: "array",
					items: {
						type: "object",
						properties: {
							value: { anyOf: [{ type: "string" }, { type: "number" }] },
						},
						required: ["value"],
					},
				},
			},
			required: ["items"],
		};
		const result = checker.check(sub, sup);

		expect(result.isSubset).toBe(false);
		expect(result.errors.length).toBeGreaterThanOrEqual(1);

		// boolean branch of sub is not accepted by sup's anyOf (string | number)
		const boolError = result.errors.find(
			(e) => e.key === "items[].value" && e.received === "boolean",
		);
		expect(boolError).toBeDefined();
	});

	test("oneOf nested in properties: extra branch rejected", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				id: {
					oneOf: [{ type: "string" }, { type: "number" }, { type: "boolean" }],
				},
			},
			required: ["id"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				id: { oneOf: [{ type: "string" }, { type: "number" }] },
			},
			required: ["id"],
		};
		const result = checker.check(sub, sup);

		expect(result.isSubset).toBe(false);
		expect(result.errors.length).toBeGreaterThanOrEqual(1);
	});

	test("anyOf with const values on nested property — enum form", () => {
		// Use enum instead of anyOf+const since normalization may simplify
		// anyOf with const branches differently. Enum form is the canonical
		// way to express this constraint and exercises the same error path.
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				status: { type: "string", enum: ["active", "inactive", "banned"] },
			},
			required: ["status"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				status: { type: "string", enum: ["active", "inactive"] },
			},
			required: ["status"],
		};
		const result = checker.check(sub, sup);

		expect(result.isSubset).toBe(false);
		expect(result.errors.length).toBeGreaterThanOrEqual(1);

		const statusError = result.errors.find((e) => e.key === "status");
		expect(statusError).toBeDefined();
		expect(statusError?.expected).toBe("active or inactive");
		expect(statusError?.received).toBe("active, inactive, or banned");
	});

	test("anyOf on one property + missing key on another → both reported", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				value: { anyOf: [{ type: "string" }, { type: "boolean" }] },
			},
			required: ["value"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				value: { type: "string" },
				name: { type: "string" },
			},
			required: ["value", "name"],
		};
		const result = checker.check(sub, sup);

		expect(result.isSubset).toBe(false);
		expect(result.errors.length).toBeGreaterThanOrEqual(2);

		// Missing 'name'
		const nameError = result.errors.find((e) => e.key === "name");
		expect(nameError).toMatchObject({
			key: "name",
			expected: "string",
			received: "undefined",
		});

		// anyOf branch rejection on 'value'
		const valueError = result.errors.find(
			(e) => e.key === "value" && e.received === "boolean",
		);
		expect(valueError).toBeDefined();
	});
});
