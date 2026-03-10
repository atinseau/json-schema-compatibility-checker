import type { JSONSchema7 } from "json-schema";
import { bench, boxplot, summary } from "mitata";
import { JsonSchemaCompatibilityChecker } from "../src";
import { run } from "./collect";

const checker = new JsonSchemaCompatibilityChecker({
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
			const min = typeof params?.min === "number" ? params.min : 0;
			return {
				valid: typeof value === "number" && value >= min,
				message: `Value must be at least ${min}`,
			};
		},
		IsCompanyEmail: (value) => ({
			valid:
				typeof value === "string" &&
				value.includes("@") &&
				value.endsWith("@acme.com"),
			message: "Value must be a company email",
		}),
		IsNonEmptyString: (value) => ({
			valid: typeof value === "string" && value.length > 0,
			message: "Value must be a non-empty string",
		}),
	},
});

const checkerWithoutConstraints = new JsonSchemaCompatibilityChecker();

// ─── Root-level constraints ───────────────────────────────────────────────────

const rootConstraintSchema: JSONSchema7 = {
	type: "string",
	constraints: ["IsUuid"],
};

const validRootConstraintData = "550e8400-e29b-41d4-a716-446655440000";
const invalidRootConstraintData = "not-a-uuid";

// ─── Simple object constraints ────────────────────────────────────────────────

const simpleConstraintSub: JSONSchema7 = {
	type: "object",
	properties: {
		id: { type: "string", constraints: ["IsUuid"] },
		age: {
			type: "number",
			constraints: [{ name: "MinAge", params: { min: 18 } }],
		},
	},
	required: ["id", "age"],
};

const simpleConstraintSup: JSONSchema7 = {
	type: "object",
	properties: {
		id: { type: "string" },
		age: { type: "number" },
	},
	required: ["id", "age"],
};

const validSimpleConstraintData = {
	id: "550e8400-e29b-41d4-a716-446655440000",
	age: 21,
};

const invalidSimpleConstraintData = {
	id: "not-a-uuid",
	age: 15,
};

// ─── Nested object constraints ────────────────────────────────────────────────

const nestedConstraintSchema: JSONSchema7 = {
	type: "object",
	properties: {
		accountId: { type: "string", constraints: ["IsUuid"] },
		owner: {
			type: "object",
			properties: {
				email: { type: "string", constraints: ["IsCompanyEmail"] },
				age: {
					type: "number",
					constraints: [{ name: "MinAge", params: { min: 21 } }],
				},
			},
			required: ["email", "age"],
		},
	},
	required: ["accountId", "owner"],
};

const validNestedConstraintData = {
	accountId: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
	owner: {
		email: "owner@acme.com",
		age: 34,
	},
};

const invalidNestedConstraintData = {
	accountId: "bad-id",
	owner: {
		email: "owner@example.com",
		age: 18,
	},
};

// ─── Array item constraints ───────────────────────────────────────────────────

const arrayConstraintSchema: JSONSchema7 = {
	type: "object",
	properties: {
		ids: {
			type: "array",
			items: { type: "string", constraints: ["IsUuid"] },
		},
	},
	required: ["ids"],
};

const validArrayConstraintData = {
	ids: [
		"550e8400-e29b-41d4-a716-446655440000",
		"6ba7b810-9dad-11d1-80b4-00c04fd430c8",
		"123e4567-e89b-12d3-a456-426614174000",
	],
};

const invalidArrayConstraintData = {
	ids: [
		"550e8400-e29b-41d4-a716-446655440000",
		"not-a-uuid",
		"123e4567-e89b-12d3-a456-426614174000",
	],
};

// ─── patternProperties constraints ────────────────────────────────────────────

const patternPropertiesConstraintSchema: JSONSchema7 = {
	type: "object",
	patternProperties: {
		"^x-": { type: "string", constraints: ["IsUuid"] },
	},
};

const validPatternPropertiesData = {
	"x-id": "550e8400-e29b-41d4-a716-446655440000",
	"x-alt": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
};

const invalidPatternPropertiesData = {
	"x-id": "not-a-uuid",
	"x-alt": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
};

// ─── additionalProperties constraints ────────────────────────────────────────

const additionalPropertiesConstraintSchema: JSONSchema7 = {
	type: "object",
	properties: {
		name: { type: "string" },
	},
	additionalProperties: {
		type: "string",
		constraints: ["IsUuid"],
	},
};

const validAdditionalPropertiesData = {
	name: "Alice",
	extraId: "550e8400-e29b-41d4-a716-446655440000",
	backupId: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
};

const invalidAdditionalPropertiesData = {
	name: "Alice",
	extraId: "not-a-uuid",
	backupId: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
};

// ─── dependencies (schema form) constraints ──────────────────────────────────

const dependencyConstraintSchema: JSONSchema7 = {
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

const validDependencyData = {
	foo: "trigger",
	bar: "550e8400-e29b-41d4-a716-446655440000",
};

const invalidDependencyData = {
	foo: "trigger",
	bar: "not-a-uuid",
};

// ─── Multiple constraints on same property ───────────────────────────────────

const multipleConstraintsSchema: JSONSchema7 = {
	type: "object",
	properties: {
		email: {
			type: "string",
			constraints: ["IsNonEmptyString", "IsCompanyEmail"],
		},
	},
	required: ["email"],
};

const validMultipleConstraintsData = {
	email: "jane@acme.com",
};

const invalidMultipleConstraintsData = {
	email: "jane@example.com",
};

// ═══════════════════════════════════════════════════════════════════════════════
//  Benchmarks — Dedicated Runtime Constraints Suite
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Root-level constraints ───────────────────────────────────────────────────

summary(() => {
	boxplot(() => {
		bench("root constraint: valid uuid string", () =>
			checker.check(rootConstraintSchema, rootConstraintSchema, {
				data: validRootConstraintData,
			}),
		);
		bench("root constraint: invalid uuid string", () =>
			checker.check(rootConstraintSchema, rootConstraintSchema, {
				data: invalidRootConstraintData,
			}),
		);
	});
});

// ─── Simple object constraints ────────────────────────────────────────────────

summary(() => {
	boxplot(() => {
		bench("simple constraints: valid object", () =>
			checker.check(simpleConstraintSub, simpleConstraintSup, {
				data: validSimpleConstraintData,
			}),
		);
		bench("simple constraints: invalid object", () =>
			checker.check(simpleConstraintSub, simpleConstraintSup, {
				data: invalidSimpleConstraintData,
			}),
		);
	});
});

// ─── Nested object constraints ────────────────────────────────────────────────

summary(() => {
	boxplot(() => {
		bench("nested constraints: valid object", () =>
			checker.check(nestedConstraintSchema, nestedConstraintSchema, {
				data: validNestedConstraintData,
			}),
		);
		bench("nested constraints: invalid object", () =>
			checker.check(nestedConstraintSchema, nestedConstraintSchema, {
				data: invalidNestedConstraintData,
			}),
		);
	});
});

// ─── Array item constraints ───────────────────────────────────────────────────

summary(() => {
	boxplot(() => {
		bench("array item constraints: valid array", () =>
			checker.check(arrayConstraintSchema, arrayConstraintSchema, {
				data: validArrayConstraintData,
			}),
		);
		bench("array item constraints: invalid array", () =>
			checker.check(arrayConstraintSchema, arrayConstraintSchema, {
				data: invalidArrayConstraintData,
			}),
		);
	});
});

// ─── patternProperties constraints ────────────────────────────────────────────

summary(() => {
	boxplot(() => {
		bench("patternProperties constraints: valid object", () =>
			checker.check(
				patternPropertiesConstraintSchema,
				patternPropertiesConstraintSchema,
				{
					data: validPatternPropertiesData,
				},
			),
		);
		bench("patternProperties constraints: invalid object", () =>
			checker.check(
				patternPropertiesConstraintSchema,
				patternPropertiesConstraintSchema,
				{
					data: invalidPatternPropertiesData,
				},
			),
		);
	});
});

// ─── additionalProperties constraints ────────────────────────────────────────

summary(() => {
	boxplot(() => {
		bench("additionalProperties constraints: valid object", () =>
			checker.check(
				additionalPropertiesConstraintSchema,
				additionalPropertiesConstraintSchema,
				{
					data: validAdditionalPropertiesData,
				},
			),
		);
		bench("additionalProperties constraints: invalid object", () =>
			checker.check(
				additionalPropertiesConstraintSchema,
				additionalPropertiesConstraintSchema,
				{
					data: invalidAdditionalPropertiesData,
				},
			),
		);
	});
});

// ─── dependencies constraints ────────────────────────────────────────────────

summary(() => {
	boxplot(() => {
		bench("dependencies constraints: valid object", () =>
			checker.check(dependencyConstraintSchema, dependencyConstraintSchema, {
				data: validDependencyData,
			}),
		);
		bench("dependencies constraints: invalid object", () =>
			checker.check(dependencyConstraintSchema, dependencyConstraintSchema, {
				data: invalidDependencyData,
			}),
		);
	});
});

// ─── Multiple constraints on one property ────────────────────────────────────

summary(() => {
	boxplot(() => {
		bench("multiple constraints: valid value", () =>
			checker.check(multipleConstraintsSchema, multipleConstraintsSchema, {
				data: validMultipleConstraintsData,
			}),
		);
		bench("multiple constraints: invalid value", () =>
			checker.check(multipleConstraintsSchema, multipleConstraintsSchema, {
				data: invalidMultipleConstraintsData,
			}),
		);
	});
});

// ─── Comparison: with registry vs without registry ────────────────────────────

summary(() => {
	boxplot(() => {
		bench("comparison: runtime check WITH constraint registry", () =>
			checker.check(simpleConstraintSub, simpleConstraintSup, {
				data: validSimpleConstraintData,
			}),
		);
		bench("comparison: runtime check WITHOUT constraint registry", () =>
			checkerWithoutConstraints.check(
				simpleConstraintSub,
				simpleConstraintSup,
				{
					data: validSimpleConstraintData,
				},
			),
		);
	});
});

await run();
