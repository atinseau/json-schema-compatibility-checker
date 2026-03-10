import type { JSONSchema7 } from "json-schema";
import { bench, boxplot, summary } from "mitata";
import { JsonSchemaCompatibilityChecker } from "../src";
import { run } from "./collect";

const checker = new JsonSchemaCompatibilityChecker();

const checkerWithConstraints = new JsonSchemaCompatibilityChecker({
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
	},
});

// ─── Conditional sup with if/then/else ───────────────────────────────────────

const conditionalSup: JSONSchema7 = {
	type: "object",
	properties: {
		kind: { type: "string" },
		value: {},
	},
	required: ["kind", "value"],
	if: {
		properties: { kind: { const: "text" } },
		required: ["kind"],
	},
	then: {
		properties: { value: { type: "string" } },
	},
	else: {
		properties: { value: { type: "number" } },
	},
};

// ─── Sub matching then-branch ────────────────────────────────────────────────

const subMatchingThen: JSONSchema7 = {
	type: "object",
	properties: {
		kind: { const: "text" },
		value: { type: "string", minLength: 1 },
	},
	required: ["kind", "value"],
};

const thenData = { kind: "text", value: "hello" };

// ─── Sub matching else-branch ────────────────────────────────────────────────

const subMatchingElse: JSONSchema7 = {
	type: "object",
	properties: {
		kind: { const: "data" },
		value: { type: "number", minimum: 0 },
	},
	required: ["kind", "value"],
};

const elseData = { kind: "data", value: 42 };

// ─── Sub violating resolved branch ───────────────────────────────────────────

const subViolating: JSONSchema7 = {
	type: "object",
	properties: {
		kind: { const: "text" },
		value: { type: "number" }, // wrong! then-branch expects string
	},
	required: ["kind", "value"],
};

// ─── Form schema: business account ───────────────────────────────────────────

const formSchema: JSONSchema7 = {
	type: "object",
	properties: {
		accountType: { type: "string", enum: ["personal", "business"] },
		email: { type: "string", format: "email" },
		companyName: { type: "string" },
		taxId: { type: "string" },
		firstName: { type: "string" },
		lastName: { type: "string" },
	},
	required: ["accountType", "email"],
	if: {
		properties: { accountType: { const: "business" } },
		required: ["accountType"],
	},
	then: { required: ["companyName", "taxId"] },
	else: { required: ["firstName", "lastName"] },
};

const businessOutput: JSONSchema7 = {
	type: "object",
	properties: {
		accountType: {
			const: "business",
			type: "string",
			enum: ["personal", "business"],
		},
		email: { type: "string", format: "email" },
		companyName: { type: "string", minLength: 1 },
		taxId: { type: "string", minLength: 1 },
	},
	required: ["accountType", "email", "companyName", "taxId"],
	additionalProperties: false,
};

const businessFormData = {
	accountType: "business",
	email: "ceo@acme.com",
	companyName: "ACME Corp",
	taxId: "123-456-789",
};

const personalOutput: JSONSchema7 = {
	type: "object",
	properties: {
		accountType: {
			const: "personal",
			type: "string",
			enum: ["personal", "business"],
		},
		email: { type: "string", format: "email" },
		firstName: { type: "string", minLength: 1 },
		lastName: { type: "string", minLength: 1 },
	},
	required: ["accountType", "email", "firstName", "lastName"],
	additionalProperties: false,
};

const personalFormData = {
	accountType: "personal",
	email: "alice@example.com",
	firstName: "Alice",
	lastName: "Dupont",
};

// ─── Incomplete form output (should fail) ────────────────────────────────────

const incompleteFormSchema: JSONSchema7 = {
	type: "object",
	properties: {
		accountType: { type: "string", enum: ["personal", "business"] },
		email: { type: "string" },
	},
	required: ["accountType", "email"],
	if: {
		properties: { accountType: { const: "business" } },
		required: ["accountType"],
	},
	then: { required: ["companyName"] },
	else: { required: ["firstName"] },
};

const incompleteOutput: JSONSchema7 = {
	type: "object",
	properties: {
		accountType: { const: "business" },
		email: { type: "string" },
	},
	required: ["accountType", "email"],
	// Missing companyName!
};

// ─── Nested conditional: config with mode ────────────────────────────────────

const nestedConditionalSup: JSONSchema7 = {
	type: "object",
	properties: {
		config: {
			type: "object",
			properties: {
				mode: { type: "string", enum: ["fast", "safe"] },
				retries: { type: "integer" },
			},
			required: ["mode"],
			if: { properties: { mode: { const: "safe" } }, required: ["mode"] },
			then: {
				required: ["retries"],
				properties: { retries: { type: "integer", minimum: 3 } },
			},
		},
	},
	required: ["config"],
};

const nestedSub: JSONSchema7 = {
	type: "object",
	properties: {
		config: {
			type: "object",
			properties: {
				mode: { const: "safe", type: "string", enum: ["fast", "safe"] },
				retries: { type: "integer", minimum: 5 },
			},
			required: ["mode", "retries"],
		},
	},
	required: ["config"],
};

const nestedData = { config: { mode: "safe", retries: 5 } };

// ─── Single data with different values ───────────────────────────────────────

const subForSingleData: JSONSchema7 = {
	type: "object",
	properties: { kind: { const: "text" }, value: { type: "string" } },
	required: ["kind", "value"],
};

const dataThen = { kind: "text", value: "hello" };
const dataElse = { kind: "other", value: "world" };

// ─── Sub with its own conditions ─────────────────────────────────────────────

const subWithConditions: JSONSchema7 = {
	type: "object",
	properties: {
		kind: { const: "text" },
		value: { type: "string" },
	},
	required: ["kind", "value"],
	if: { properties: { kind: { const: "text" } }, required: ["kind"] },
	then: { properties: { value: { type: "string", minLength: 1 } } },
};

// ─── Pattern in resolved schemas ─────────────────────────────────────────────

const patternSup: JSONSchema7 = {
	type: "object",
	properties: {
		mode: { type: "string" },
		code: { type: "string" },
	},
	required: ["mode", "code"],
	if: {
		properties: { mode: { const: "strict" } },
		required: ["mode"],
	},
	then: {
		properties: {
			code: { type: "string", pattern: "^[A-Z]{3}-[0-9]{4}$" },
		},
	},
};

const patternSub: JSONSchema7 = {
	type: "object",
	properties: {
		mode: { const: "strict", type: "string" },
		code: { type: "string", pattern: "^[A-Z]{3}-[0-9]{4}$" },
	},
	required: ["mode", "code"],
};

const patternData = { mode: "strict" };

// ─── allOf + if/then/else combined ───────────────────────────────────────────

const allOfConditionalSup: JSONSchema7 = {
	type: "object",
	properties: {
		name: { type: "string" },
		age: { type: "number" },
		role: { type: "string", enum: ["admin", "user", "guest"] },
	},
	required: ["name"],
	allOf: [
		{
			if: {
				properties: { age: { type: "number", exclusiveMinimum: 20 } },
				required: ["age"],
			},
			then: {
				required: ["email"],
				properties: { email: { type: "string" } },
			},
		},
		{
			if: {
				properties: { role: { const: "admin" } },
				required: ["role"],
			},
			then: {
				properties: {
					permissions: { type: "array", items: { type: "string" } },
				},
				required: ["permissions"],
			},
		},
	],
};

const allOfSub: JSONSchema7 = {
	type: "object",
	properties: {
		name: { type: "string" },
		age: { type: "number" },
		role: { type: "string", enum: ["admin", "user", "guest"] },
		email: { type: "string" },
		permissions: { type: "array", items: { type: "string" } },
	},
	required: ["name", "age", "role", "email", "permissions"],
};

const allOfData = {
	name: "Alice",
	age: 25,
	role: "admin",
	email: "alice@example.com",
	permissions: ["read", "write"],
};

// ─── Runtime constraints ─────────────────────────────────────────────────────

const constraintSub: JSONSchema7 = {
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

const constraintSup: JSONSchema7 = {
	type: "object",
	properties: {
		id: { type: "string" },
		age: { type: "number" },
	},
	required: ["id", "age"],
};

const validConstraintData = {
	id: "550e8400-e29b-41d4-a716-446655440000",
	age: 21,
};

const invalidConstraintData = {
	id: "not-a-uuid",
	age: 15,
};

// ─── Benchmarks ──────────────────────────────────────────────────────────────

summary(() => {
	boxplot(() => {
		bench("then-branch match (text → string)", () =>
			checker.check(subMatchingThen, conditionalSup, { data: thenData }),
		);
		bench("else-branch match (data → number)", () =>
			checker.check(subMatchingElse, conditionalSup, { data: elseData }),
		);
		bench("violating resolved branch (text → wrong type)", () =>
			checker.check(subViolating, conditionalSup, { data: thenData }),
		);
	});
});

summary(() => {
	boxplot(() => {
		bench("form: business output ⊆ conditional form (resolved)", () =>
			checker.check(businessOutput, formSchema, {
				data: businessFormData,
			}),
		);
		bench("form: personal output ⊆ conditional form (resolved)", () =>
			checker.check(personalOutput, formSchema, {
				data: personalFormData,
			}),
		);
		bench("form: incomplete output ⊄ conditional form (missing required)", () =>
			checker.check(incompleteOutput, incompleteFormSchema, {
				data: businessFormData,
			}),
		);
	});
});

summary(() => {
	boxplot(() => {
		bench("nested: safe config (recursive resolution)", () =>
			checker.check(nestedSub, nestedConditionalSup, {
				data: nestedData,
			}),
		);
	});
});

summary(() => {
	boxplot(() => {
		bench("single data: then resolution", () =>
			checker.check(subForSingleData, conditionalSup, {
				data: dataThen,
			}),
		);
		bench("single data: else resolution", () =>
			checker.check(subForSingleData, conditionalSup, {
				data: dataElse,
			}),
		);
	});
});

summary(() => {
	boxplot(() => {
		bench("sub with own conditions: both resolved", () =>
			checker.check(subWithConditions, conditionalSup, {
				data: thenData,
			}),
		);
	});
});

summary(() => {
	boxplot(() => {
		bench("pattern: resolved sup adds pattern constraint", () =>
			checker.check(patternSub, patternSup, { data: patternData }),
		);
	});
});

summary(() => {
	boxplot(() => {
		bench("allOf: multiple conditions in allOf resolved", () =>
			checker.check(allOfSub, allOfConditionalSup, { data: allOfData }),
		);
	});
});

summary(() => {
	boxplot(() => {
		bench("constraints: valid runtime data", () =>
			checkerWithConstraints.check(constraintSub, constraintSup, {
				data: validConstraintData,
			}),
		);
		bench("constraints: invalid runtime data", () =>
			checkerWithConstraints.check(constraintSub, constraintSup, {
				data: invalidConstraintData,
			}),
		);
	});
});

// ─── Comparison: isSubset (without resolution) vs check with conditions ──────

summary(() => {
	boxplot(() => {
		bench("comparison: isSubset WITHOUT resolution (false negative)", () =>
			checker.isSubset(subMatchingThen, conditionalSup),
		);
		bench("comparison: check WITH resolution (correct)", () =>
			checker.check(subMatchingThen, conditionalSup, { data: thenData }),
		);
	});
});

await run();
