import type { JSONSchema7 } from "json-schema";
import { bench, boxplot, summary } from "mitata";
import { MergeEngine, resolveConditions } from "../src";
import { run } from "./collect";

const engine = new MergeEngine();

// ─── Simple if/then/else ─────────────────────────────────────────────────────

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
	then: {
		required: ["companyName", "taxId"],
	},
	else: {
		required: ["firstName", "lastName"],
	},
};

const businessData = { accountType: "business" };
const personalData = { accountType: "personal" };
const emptyData = {};

// ─── Schema without if/then/else (passthrough) ──────────────────────────────

const noConditionSchema: JSONSchema7 = {
	type: "object",
	properties: {
		name: { type: "string" },
	},
	required: ["name"],
};

// ─── If/then without else ────────────────────────────────────────────────────

const ifThenOnlySchema: JSONSchema7 = {
	type: "object",
	properties: {
		status: { type: "string" },
		activatedAt: { type: "string", format: "date-time" },
	},
	required: ["status"],
	if: {
		properties: { status: { const: "active" } },
		required: ["status"],
	},
	then: {
		required: ["activatedAt"],
	},
};

const activeData = { status: "active" };
const inactiveData = { status: "inactive" };

// ─── Enum-based condition ────────────────────────────────────────────────────

const enumConditionSchema: JSONSchema7 = {
	type: "object",
	properties: {
		tier: { type: "string" },
		limit: { type: "number" },
	},
	required: ["tier"],
	if: {
		properties: {
			tier: { enum: ["premium", "enterprise"] },
		},
		required: ["tier"],
	},
	then: {
		properties: {
			limit: { type: "number", minimum: 1000 },
		},
		required: ["limit"],
	},
	else: {
		properties: {
			limit: { type: "number", maximum: 100 },
		},
	},
};

const premiumData = { tier: "premium" };
const freeData = { tier: "free" };

// ─── Property merging (then overrides) ───────────────────────────────────────

const overrideSchema: JSONSchema7 = {
	type: "object",
	properties: {
		mode: { type: "string" },
		name: { type: "string", maxLength: 100 },
	},
	required: ["mode"],
	if: {
		properties: { mode: { const: "short" } },
		required: ["mode"],
	},
	then: {
		properties: { name: { type: "string", maxLength: 50 } },
	},
};

const shortModeData = { mode: "short" };
const longModeData = { mode: "long" };

// ─── Then overrides additionalProperties ─────────────────────────────────────

const additionalPropsOverrideSchema: JSONSchema7 = {
	type: "object",
	properties: { mode: { type: "string" } },
	additionalProperties: true,
	if: {
		properties: { mode: { const: "strict" } },
		required: ["mode"],
	},
	then: { additionalProperties: false },
};

const strictModeData = { mode: "strict" };

// ─── Then overrides array minItems ───────────────────────────────────────────

const arrayOverrideSchema: JSONSchema7 = {
	type: "object",
	properties: {
		mode: { type: "string" },
		tags: { type: "array", items: { type: "string" }, minItems: 1 },
	},
	required: ["mode"],
	if: {
		properties: { mode: { const: "strict" } },
		required: ["mode"],
	},
	then: {
		properties: {
			tags: { type: "array", items: { type: "string" }, minItems: 5 },
		},
	},
};

// ─── Nested conditions in properties ─────────────────────────────────────────

const nestedConditionSchema: JSONSchema7 = {
	type: "object",
	properties: {
		config: {
			type: "object",
			properties: {
				mode: { type: "string", enum: ["fast", "safe"] },
				retries: { type: "integer" },
				timeout: { type: "number" },
			},
			required: ["mode"],
			if: {
				properties: { mode: { const: "safe" } },
				required: ["mode"],
			},
			then: {
				required: ["retries", "timeout"],
				properties: {
					retries: { type: "integer", minimum: 3 },
					timeout: { type: "number", minimum: 5000 },
				},
			},
		},
	},
	required: ["config"],
};

const safeConfigData = { config: { mode: "safe" } };
const fastConfigData = { config: { mode: "fast" } };

// ─── allOf containing if/then/else ───────────────────────────────────────────

const allOfConditionsSchema: JSONSchema7 = {
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
				properties: {
					age: { type: "number", exclusiveMinimum: 20 },
				},
				required: ["age"],
			},
			then: {
				required: ["email"],
				properties: {
					email: { type: "string" },
				},
			},
		},
		{
			if: {
				properties: {
					role: { const: "admin" },
				},
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

const allOfBothMatchData = { name: "Alice", age: 25, role: "admin" };
const allOfFirstMatchData = { name: "Bob", age: 25 };
const allOfSecondMatchData = { name: "Charlie", role: "admin" };
const allOfNoMatchData = { name: "Dave" };

// ─── allOf with else branches ────────────────────────────────────────────────

const allOfWithElseSchema: JSONSchema7 = {
	type: "object",
	properties: {
		mode: { type: "string" },
	},
	required: ["mode"],
	allOf: [
		{
			if: {
				properties: { mode: { const: "debug" } },
				required: ["mode"],
			},
			then: {
				properties: { debug: { type: "boolean" } },
				required: ["debug"],
			},
			else: {
				properties: { simple: { type: "boolean" } },
				required: ["simple"],
			},
		},
	],
};

const debugModeData = { mode: "debug" };
const productionModeData = { mode: "production" };

// ─── allOf with non-conditional entries ──────────────────────────────────────

const allOfMixedSchema: JSONSchema7 = {
	type: "object",
	properties: {
		name: { type: "string" },
	},
	allOf: [
		{ required: ["name"] },
		{
			if: {
				properties: { name: { const: "secret" } },
				required: ["name"],
			},
			then: {
				properties: { secret: { type: "string" } },
			},
		},
	],
};

const secretNameData = { name: "secret" };
const normalNameData = { name: "normal" };

// ─── Top-level + allOf conditions combined ───────────────────────────────────

const combinedConditionsSchema: JSONSchema7 = {
	type: "object",
	properties: {
		kind: { type: "string" },
		value: {},
	},
	required: ["kind"],
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
	allOf: [
		{
			if: {
				properties: { kind: { const: "number" } },
				required: ["kind"],
			},
			then: {
				properties: { precision: { type: "number" } },
			},
		},
	],
};

const textKindData = { kind: "text" };
const numberKindData = { kind: "number" };

// ─── Complex: evaluateCondition with numeric/pattern/format ──────────────────

const numericConditionSchema: JSONSchema7 = {
	type: "object",
	properties: {
		age: { type: "number" },
	},
	if: {
		properties: { age: { minimum: 18 } },
	},
	then: {
		required: ["canVote"],
	},
};

const adultData = { age: 25 };
const minorData = { age: 10 };

const patternConditionSchema: JSONSchema7 = {
	type: "object",
	properties: {
		code: { type: "string" },
	},
	if: {
		properties: { code: { pattern: "^[A-Z]{3}$" } },
	},
	then: {
		required: ["valid"],
	},
};

const validCodeData = { code: "ABC" };
const invalidCodeData = { code: "abc" };

const formatConditionSchema: JSONSchema7 = {
	type: "object",
	properties: {
		contact: { type: "string" },
		contactLabel: { type: "string" },
	},
	if: {
		properties: { contact: { format: "email" } },
	},
	then: {
		properties: { contactLabel: { const: "Email" } },
	},
	else: {
		properties: { contactLabel: { const: "Other" } },
	},
};

const emailContactData = { contact: "test@example.com" };
const phoneContactData = { contact: "+33612345678" };

// ─── Nested object data in evaluateCondition ─────────────────────────────────

const nestedObjectConditionSchema: JSONSchema7 = {
	type: "object",
	properties: {
		address: {
			type: "object",
			properties: {
				country: { type: "string" },
			},
		},
		siret: { type: "string" },
	},
	if: {
		properties: {
			address: {
				properties: { country: { const: "FR" } },
				required: ["country"],
			},
		},
	},
	then: {
		required: ["siret"],
	},
};

const frenchAddressData = { address: { country: "FR" } };
const usAddressData = { address: { country: "US" } };

// ─── if with allOf inside ────────────────────────────────────────────────────

const ifAllOfSchema: JSONSchema7 = {
	type: "object",
	properties: {
		contactMethod: { type: "string", enum: ["email", "phone"] },
		contactValue: { type: "string" },
	},
	if: {
		allOf: [
			{ properties: { contactMethod: { const: "email" } } },
			{ required: ["contactValue"] },
		],
	},
	then: {
		properties: { contactValue: { format: "email" } },
	},
	else: {
		properties: { contactValue: { pattern: "^\\+?[0-9]+" } },
	},
};

const emailMethodData = {
	contactMethod: "email",
	contactValue: "test@example.com",
};
const phoneMethodData = {
	contactMethod: "phone",
	contactValue: "+33612345678",
};

// ─── if with anyOf inside ────────────────────────────────────────────────────

const ifAnyOfSchema: JSONSchema7 = {
	type: "object",
	properties: {
		role: { type: "string" },
		permissions: { type: "array" },
	},
	if: {
		anyOf: [
			{ properties: { role: { const: "admin" } } },
			{ properties: { role: { const: "superadmin" } } },
		],
	},
	then: {
		required: ["permissions"],
	},
};

const adminRoleData = { role: "admin" };
const userRoleData = { role: "user" };

// ─── if with not inside ──────────────────────────────────────────────────────

const ifNotSchema: JSONSchema7 = {
	type: "object",
	properties: {
		type: { type: "string" },
		companyName: { type: "string" },
	},
	if: {
		not: {
			properties: { type: { const: "personal" } },
		},
	},
	then: {
		required: ["companyName"],
	},
	else: {
		required: [],
	},
};

const businessTypeData = { type: "business" };
const personalTypeData = { type: "personal" };

// ─── Benchmarks ──────────────────────────────────────────────────────────────

summary(() => {
	boxplot(() => {
		bench("simple: then-branch (business)", () =>
			resolveConditions(formSchema, businessData, engine),
		);
		bench("simple: else-branch (personal)", () =>
			resolveConditions(formSchema, personalData, engine),
		);
		bench("simple: missing discriminant (empty data)", () =>
			resolveConditions(formSchema, emptyData, engine),
		);
		bench("passthrough: no if/then/else", () =>
			resolveConditions(noConditionSchema, emptyData, engine),
		);
	});
});

summary(() => {
	boxplot(() => {
		bench("if/then only: matching → then", () =>
			resolveConditions(ifThenOnlySchema, activeData, engine),
		);
		bench("if/then only: not matching → no extra constraints", () =>
			resolveConditions(ifThenOnlySchema, inactiveData, engine),
		);
	});
});

summary(() => {
	boxplot(() => {
		bench("enum condition: premium → then", () =>
			resolveConditions(enumConditionSchema, premiumData, engine),
		);
		bench("enum condition: free → else", () =>
			resolveConditions(enumConditionSchema, freeData, engine),
		);
	});
});

summary(() => {
	boxplot(() => {
		bench("property override: maxLength reduced", () =>
			resolveConditions(overrideSchema, shortModeData, engine),
		);
		bench("property override: no override", () =>
			resolveConditions(overrideSchema, longModeData, engine),
		);
		bench("additionalProperties override: true → false", () =>
			resolveConditions(additionalPropsOverrideSchema, strictModeData, engine),
		);
		bench("array override: minItems 1 → 5", () =>
			resolveConditions(arrayOverrideSchema, strictModeData, engine),
		);
	});
});

summary(() => {
	boxplot(() => {
		bench("nested: safe config → then (recursive)", () =>
			resolveConditions(nestedConditionSchema, safeConfigData, engine),
		);
		bench("nested: fast config → else (recursive)", () =>
			resolveConditions(nestedConditionSchema, fastConfigData, engine),
		);
	});
});

summary(() => {
	boxplot(() => {
		bench("allOf: both conditions match", () =>
			resolveConditions(allOfConditionsSchema, allOfBothMatchData, engine),
		);
		bench("allOf: first condition only", () =>
			resolveConditions(allOfConditionsSchema, allOfFirstMatchData, engine),
		);
		bench("allOf: second condition only", () =>
			resolveConditions(allOfConditionsSchema, allOfSecondMatchData, engine),
		);
		bench("allOf: no conditions match", () =>
			resolveConditions(allOfConditionsSchema, allOfNoMatchData, engine),
		);
	});
});

summary(() => {
	boxplot(() => {
		bench("allOf else: debug → then", () =>
			resolveConditions(allOfWithElseSchema, debugModeData, engine),
		);
		bench("allOf else: production → else", () =>
			resolveConditions(allOfWithElseSchema, productionModeData, engine),
		);
		bench("allOf mixed: conditional + non-conditional (secret)", () =>
			resolveConditions(allOfMixedSchema, secretNameData, engine),
		);
		bench("allOf mixed: conditional + non-conditional (normal)", () =>
			resolveConditions(allOfMixedSchema, normalNameData, engine),
		);
	});
});

summary(() => {
	boxplot(() => {
		bench("combined: top-level + allOf (text)", () =>
			resolveConditions(combinedConditionsSchema, textKindData, engine),
		);
		bench("combined: top-level + allOf (number)", () =>
			resolveConditions(combinedConditionsSchema, numberKindData, engine),
		);
	});
});

summary(() => {
	boxplot(() => {
		bench("evaluate: numeric minimum (adult)", () =>
			resolveConditions(numericConditionSchema, adultData, engine),
		);
		bench("evaluate: numeric minimum (minor)", () =>
			resolveConditions(numericConditionSchema, minorData, engine),
		);
		bench("evaluate: pattern match (valid)", () =>
			resolveConditions(patternConditionSchema, validCodeData, engine),
		);
		bench("evaluate: pattern match (invalid)", () =>
			resolveConditions(patternConditionSchema, invalidCodeData, engine),
		);
	});
});

summary(() => {
	boxplot(() => {
		bench("evaluate: format email (valid)", () =>
			resolveConditions(formatConditionSchema, emailContactData, engine),
		);
		bench("evaluate: format email (invalid)", () =>
			resolveConditions(formatConditionSchema, phoneContactData, engine),
		);
	});
});

summary(() => {
	boxplot(() => {
		bench("evaluate: nested object data (FR)", () =>
			resolveConditions(nestedObjectConditionSchema, frenchAddressData, engine),
		);
		bench("evaluate: nested object data (US)", () =>
			resolveConditions(nestedObjectConditionSchema, usAddressData, engine),
		);
	});
});

summary(() => {
	boxplot(() => {
		bench("if allOf: email method", () =>
			resolveConditions(ifAllOfSchema, emailMethodData, engine),
		);
		bench("if allOf: phone method", () =>
			resolveConditions(ifAllOfSchema, phoneMethodData, engine),
		);
		bench("if anyOf: admin role", () =>
			resolveConditions(ifAnyOfSchema, adminRoleData, engine),
		);
		bench("if anyOf: user role", () =>
			resolveConditions(ifAnyOfSchema, userRoleData, engine),
		);
		bench("if not: business type → then", () =>
			resolveConditions(ifNotSchema, businessTypeData, engine),
		);
		bench("if not: personal type → else", () =>
			resolveConditions(ifNotSchema, personalTypeData, engine),
		);
	});
});

await run();
