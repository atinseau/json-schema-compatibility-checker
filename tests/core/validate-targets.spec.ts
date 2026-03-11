import { beforeAll, describe, expect, test } from "bun:test";
import type { JSONSchema7 } from "json-schema";
import { JsonSchemaCompatibilityChecker } from "../../src";

// ─────────────────────────────────────────────────────────────────────────────
//  validate targets — granular runtime validation control
// ─────────────────────────────────────────────────────────────────────────────
//
// The `validate` option in `CheckRuntimeOptions` accepts:
//   - `true`                       → validate data against both sub and sup
//   - `false` / omitted            → no runtime validation
//   - `{ sub: true }`              → validate only against the sub schema
//   - `{ sup: true }`              → validate only against the sup schema
//   - `{ sub: true, sup: true }`   → equivalent to `true`
//   - `{ sub: false, sup: false }` → equivalent to `false`

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Schema pair designed so that:
 *   - sub has `required: ['accountId']` + `additionalProperties: false`
 *   - sup is a loose object with a constrained property
 *   - sub ⊆ sup structurally (static check passes)
 *   - data `{}` fails AJV against sub (missing required) but passes against sup
 */
const closedSubSchema: JSONSchema7 = {
	type: "object",
	properties: {
		accountId: { type: "string" },
	},
	required: ["accountId"],
	additionalProperties: false,
};

const looseSupSchema: JSONSchema7 = {
	type: "object",
	properties: {
		accountId: { type: "string" },
	},
};

/**
 * Schema pair where:
 *   - sub is a loose object (no required)
 *   - sup has `required: ['id']`
 *   - sub ⊆ sup structurally fails (sub missing required 'id')
 *     → but if we flip: sup ⊆ sub? No. We need a pair where static passes
 *       but sup validation fails.
 *
 * Actually: let's use a pair where static check passes and data fails
 * against sup but passes against sub.
 */
const _looseSubSchema: JSONSchema7 = {
	type: "object",
	properties: {
		value: { type: "string" },
	},
};

const _strictSupSchema: JSONSchema7 = {
	type: "object",
	properties: {
		value: { type: "string", minLength: 5 },
	},
	required: ["value"],
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe("validate targets — boolean shorthand", () => {
	let checker: JsonSchemaCompatibilityChecker;

	beforeAll(() => {
		checker = new JsonSchemaCompatibilityChecker();
	});

	test("validate: true — errors from both sub and sup", async () => {
		// data {} fails sub (missing required accountId) and passes sup
		const result = await checker.check(closedSubSchema, looseSupSchema, {
			data: {},
			validate: true,
		});

		// Static check passes (closedSub ⊆ looseSup)
		// Runtime: AJV validates {} against sub → fails (missing accountId)
		const subErrors = result.errors.filter((e) => e.key.startsWith("$sub"));
		expect(subErrors.length).toBeGreaterThan(0);
	});

	test("validate: false — no runtime validation errors", async () => {
		const result = await checker.check(closedSubSchema, looseSupSchema, {
			data: {},
			validate: false,
		});

		// Static check passes, no runtime validation → isSubset: true
		expect(result.isSubset).toBe(true);
		expect(result.errors).toEqual([]);
	});

	test("validate: undefined (omitted) — no runtime validation errors", async () => {
		const result = await checker.check(closedSubSchema, looseSupSchema, {
			data: {},
		});

		expect(result.isSubset).toBe(true);
		expect(result.errors).toEqual([]);
	});
});

describe("validate targets — object form", () => {
	let checker: JsonSchemaCompatibilityChecker;

	beforeAll(() => {
		checker = new JsonSchemaCompatibilityChecker();
	});

	test("validate: { sup: true } — skips sub validation, validates sup only", async () => {
		// data {} fails sub (missing required accountId) but passes sup (no required)
		const result = await checker.check(closedSubSchema, looseSupSchema, {
			data: {},
			validate: { sup: true },
		});

		// Sub validation skipped → no $sub errors
		// Sup validation runs → {} is valid for looseSup (no required fields)
		expect(result.isSubset).toBe(true);
		expect(result.errors).toEqual([]);
		const subErrors = result.errors.filter((e) => e.key.startsWith("$sub"));
		expect(subErrors).toEqual([]);
	});

	test("validate: { sub: true } — validates sub only, skips sup", async () => {
		// data {} fails sub (missing required accountId)
		const result = await checker.check(closedSubSchema, looseSupSchema, {
			data: {},
			validate: { sub: true },
		});

		expect(result.isSubset).toBe(false);
		const subErrors = result.errors.filter((e) => e.key.startsWith("$sub"));
		expect(subErrors.length).toBeGreaterThan(0);

		// No $sup errors since sup validation is skipped
		const supErrors = result.errors.filter((e) => e.key.startsWith("$sup"));
		expect(supErrors).toEqual([]);
	});

	test("validate: { sub: true, sup: true } — equivalent to validate: true", async () => {
		const result = await checker.check(closedSubSchema, looseSupSchema, {
			data: {},
			validate: { sub: true, sup: true },
		});

		// Same as validate: true — sub validation fails
		const subErrors = result.errors.filter((e) => e.key.startsWith("$sub"));
		expect(subErrors.length).toBeGreaterThan(0);
	});

	test("validate: { sub: false, sup: false } — equivalent to validate: false", async () => {
		const result = await checker.check(closedSubSchema, looseSupSchema, {
			data: {},
			validate: { sub: false, sup: false },
		});

		expect(result.isSubset).toBe(true);
		expect(result.errors).toEqual([]);
	});

	test("validate: { sup: true } — reports sup errors when data is invalid for sup", async () => {
		// looseSubSchema ⊆ strictSupSchema statically? No — sub doesn't have
		// required: ['value']. Let's use schemas where static passes but sup fails.
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				value: { type: "string", minLength: 5 },
			},
			required: ["value"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				value: { type: "string", minLength: 5 },
			},
			required: ["value"],
		};

		const result = await checker.check(sub, sup, {
			data: { value: "ab" }, // too short — fails both
			validate: { sup: true },
		});

		expect(result.isSubset).toBe(false);
		const supErrors = result.errors.filter((e) => e.key.startsWith("$sup"));
		expect(supErrors.length).toBeGreaterThan(0);

		// Sub validation skipped
		const subErrors = result.errors.filter((e) => e.key.startsWith("$sub"));
		expect(subErrors).toEqual([]);
	});

	test("validate: { sub: true } — reports sub errors when data is invalid for sub", async () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				value: { type: "string", minLength: 5 },
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

		const result = await checker.check(sub, sup, {
			data: { value: "ab" }, // too short for sub (minLength: 5), valid for sup
			validate: { sub: true },
		});

		expect(result.isSubset).toBe(false);
		const subErrors = result.errors.filter((e) => e.key.startsWith("$sub"));
		expect(subErrors.length).toBeGreaterThan(0);

		const supErrors = result.errors.filter((e) => e.key.startsWith("$sup"));
		expect(supErrors).toEqual([]);
	});
});

// ── Constraint validation with granular targets ─────────────────────────────

describe("validate targets — constraint validation", () => {
	let checker: JsonSchemaCompatibilityChecker;

	beforeAll(() => {
		checker = new JsonSchemaCompatibilityChecker({
			constraints: {
				IsUuid: () => ({
					valid: false,
					message: "Value must be a valid UUID",
				}),
			},
		});
	});

	test("validate: { sup: true } — constraints on sup are validated", async () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				id: { type: "string" },
			},
			required: ["id"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				id: { type: "string", constraints: "IsUuid" },
			},
			required: ["id"],
		};

		const result = await checker.check(sub, sup, {
			data: { id: "not-a-uuid" },
			validate: { sup: true },
		});

		expect(result.isSubset).toBe(false);
		const supErrors = result.errors.filter((e) => e.key.startsWith("$sup"));
		expect(supErrors.length).toBeGreaterThan(0);

		// Sub constraints NOT validated
		const subErrors = result.errors.filter((e) => e.key.startsWith("$sub"));
		expect(subErrors).toEqual([]);
	});

	test("validate: { sub: true } — constraints on sub are validated, sup skipped", async () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				id: { type: "string", constraints: "IsUuid" },
			},
			required: ["id"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				id: { type: "string", constraints: "IsUuid" },
			},
			required: ["id"],
		};

		const result = await checker.check(sub, sup, {
			data: { id: "not-a-uuid" },
			validate: { sub: true },
		});

		expect(result.isSubset).toBe(false);
		const subErrors = result.errors.filter((e) => e.key.startsWith("$sub"));
		expect(subErrors.length).toBeGreaterThan(0);

		// Sup constraints NOT validated
		const supErrors = result.errors.filter((e) => e.key.startsWith("$sup"));
		expect(supErrors).toEqual([]);
	});

	test("validate: true — constraints on both sub and sup are validated", async () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				id: { type: "string", constraints: "IsUuid" },
			},
			required: ["id"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				id: { type: "string", constraints: "IsUuid" },
			},
			required: ["id"],
		};

		const result = await checker.check(sub, sup, {
			data: { id: "not-a-uuid" },
			validate: true,
		});

		expect(result.isSubset).toBe(false);
		const subErrors = result.errors.filter((e) => e.key.startsWith("$sub"));
		const supErrors = result.errors.filter((e) => e.key.startsWith("$sup"));
		expect(subErrors.length).toBeGreaterThan(0);
		expect(supErrors.length).toBeGreaterThan(0);
	});

	test("validate: { sup: true } — constraints on sub are NOT validated even if present", async () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				id: { type: "string", constraints: "IsUuid" },
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

		const result = await checker.check(sub, sup, {
			data: { id: "not-a-uuid" },
			validate: { sup: true },
		});

		// Sup has no constraints, so sup constraint validation passes
		// Sub constraints exist but are not validated (validate.sub not set)
		// AJV validation of sup passes (valid string)
		expect(result.isSubset).toBe(true);
		expect(result.errors).toEqual([]);
	});
});

// ── Original use case: closedOutputSchema ⊆ nodeInputSchema ─────────────────

describe("validate targets — pipeline connection use case", () => {
	let checker: JsonSchemaCompatibilityChecker;

	beforeAll(() => {
		checker = new JsonSchemaCompatibilityChecker({
			constraints: {
				IsUuid: () => ({
					valid: false,
					message: "Value must be a valid UUID",
				}),
			},
		});
	});

	test("validate: true with empty data fails on sub (required property missing)", async () => {
		const closedOutput: JSONSchema7 = {
			type: "object",
			properties: { accountId: { type: "string" } },
			required: ["accountId"],
			additionalProperties: false,
		};
		const nodeInput: JSONSchema7 = {
			type: "object",
			properties: {
				accountId: { type: "string", constraints: "IsUuid" },
			},
		};

		const result = await checker.check(closedOutput, nodeInput, {
			data: {},
			validate: true,
		});

		// Fails because {} doesn't satisfy sub's required: ['accountId']
		expect(result.isSubset).toBe(false);
		const subErrors = result.errors.filter((e) => e.key.startsWith("$sub"));
		expect(subErrors.length).toBeGreaterThan(0);
	});

	test("validate: { sup: true } with empty data succeeds (sub validation skipped)", async () => {
		const closedOutput: JSONSchema7 = {
			type: "object",
			properties: { accountId: { type: "string" } },
			required: ["accountId"],
			additionalProperties: false,
		};
		const nodeInput: JSONSchema7 = {
			type: "object",
			properties: {
				accountId: { type: "string", constraints: "IsUuid" },
			},
		};

		const result = await checker.check(closedOutput, nodeInput, {
			data: {},
			validate: { sup: true },
		});

		// Sub validation skipped → no required-property error
		// Sup validation: {} is valid for nodeInput (accountId not required)
		// Constraint on accountId not triggered (accountId not in data)
		expect(result.isSubset).toBe(true);
		expect(result.errors).toEqual([]);
	});

	test("validate: { sup: true } with accountId in data triggers constraint", async () => {
		const closedOutput: JSONSchema7 = {
			type: "object",
			properties: { accountId: { type: "string" } },
			required: ["accountId"],
			additionalProperties: false,
		};
		const nodeInput: JSONSchema7 = {
			type: "object",
			properties: {
				accountId: { type: "string", constraints: "IsUuid" },
			},
		};

		const result = await checker.check(closedOutput, nodeInput, {
			data: { accountId: "not-a-uuid" },
			validate: { sup: true },
		});

		// Constraint IsUuid always fails → sup constraint error
		expect(result.isSubset).toBe(false);
		const supErrors = result.errors.filter((e) => e.key.startsWith("$sup"));
		expect(supErrors.length).toBeGreaterThan(0);
	});
});

// ── Static check failures are unaffected by validate targets ─────────────────

describe("validate targets — static check priority", () => {
	let checker: JsonSchemaCompatibilityChecker;

	beforeAll(() => {
		checker = new JsonSchemaCompatibilityChecker();
	});

	test("static incompatibility reported regardless of validate setting", async () => {
		const sub: JSONSchema7 = { type: "string" };
		const sup: JSONSchema7 = { type: "number" };

		const resultTrue = await checker.check(sub, sup, {
			data: "hello",
			validate: true,
		});
		const resultSup = await checker.check(sub, sup, {
			data: "hello",
			validate: { sup: true },
		});
		const resultFalse = await checker.check(sub, sup, {
			data: "hello",
			validate: false,
		});

		// All three detect the static incompatibility
		expect(resultTrue.isSubset).toBe(false);
		expect(resultSup.isSubset).toBe(false);
		expect(resultFalse.isSubset).toBe(false);

		// Static errors don't have $sub/$sup prefixes (they come from semantic-errors)
		for (const result of [resultTrue, resultSup, resultFalse]) {
			expect(result.errors.length).toBeGreaterThan(0);
		}
	});
});

// ── Edge cases ───────────────────────────────────────────────────────────────

describe("validate targets — edge cases", () => {
	let checker: JsonSchemaCompatibilityChecker;

	beforeAll(() => {
		checker = new JsonSchemaCompatibilityChecker();
	});

	test("validate: {} (empty object) — equivalent to false", async () => {
		const result = await checker.check(closedSubSchema, looseSupSchema, {
			data: {},
			validate: {},
		});

		expect(result.isSubset).toBe(true);
		expect(result.errors).toEqual([]);
	});

	test("validate: { sub: false } — equivalent to false", async () => {
		const result = await checker.check(closedSubSchema, looseSupSchema, {
			data: {},
			validate: { sub: false },
		});

		expect(result.isSubset).toBe(true);
		expect(result.errors).toEqual([]);
	});

	test("validate: { sup: false } — equivalent to false", async () => {
		const result = await checker.check(closedSubSchema, looseSupSchema, {
			data: {},
			validate: { sup: false },
		});

		expect(result.isSubset).toBe(true);
		expect(result.errors).toEqual([]);
	});

	test("validate with data: undefined — no runtime validation regardless of targets", async () => {
		const result = await checker.check(closedSubSchema, looseSupSchema, {
			data: undefined,
			validate: { sub: true, sup: true },
		});

		// data is undefined → runtime validation block is skipped entirely
		expect(result.isSubset).toBe(true);
		expect(result.errors).toEqual([]);
	});
});
