import type { JSONSchema7 } from "json-schema";
import { bench, boxplot, summary } from "mitata";
import {
	JsonSchemaCompatibilityChecker,
	MergeEngine,
	resolveConditions,
} from "../src";
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
		IsCompanyEmail: (value) => ({
			valid:
				typeof value === "string" &&
				value.endsWith("@acme.com") &&
				value.includes("@"),
			message: "Value must be a company email",
		}),
	},
});
const engine = new MergeEngine();

// ─── API Response → Expected Input (compatible) ─────────────────────────────

const apiResponse: JSONSchema7 = {
	type: "object",
	properties: {
		status: { type: "integer", minimum: 100, maximum: 599 },
		data: {
			type: "object",
			properties: {
				users: {
					type: "array",
					items: {
						type: "object",
						properties: {
							id: { type: "string", format: "uuid" },
							email: { type: "string", format: "email" },
							name: { type: "string", minLength: 1 },
							role: { type: "string", enum: ["admin", "user", "viewer"] },
						},
						required: ["id", "email", "name", "role"],
					},
					minItems: 0,
				},
				total: { type: "integer", minimum: 0 },
			},
			required: ["users", "total"],
		},
	},
	required: ["status", "data"],
};

const expectedInput: JSONSchema7 = {
	type: "object",
	properties: {
		status: { type: "integer" },
		data: {
			type: "object",
			properties: {
				users: {
					type: "array",
					items: {
						type: "object",
						properties: {
							id: { type: "string" },
							email: { type: "string" },
							name: { type: "string" },
						},
						required: ["id", "email"],
					},
				},
				total: { type: "number" },
			},
			required: ["users"],
		},
	},
	required: ["data"],
};

// ─── Webhook Payload → Strict Event (incompatible) ──────────────────────────

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

// ─── Discriminated Union Output → Flexible Input ─────────────────────────────

const discriminatedUnionOutput: JSONSchema7 = {
	oneOf: [
		{
			type: "object",
			properties: {
				type: { const: "success" },
				data: { type: "object" },
			},
			required: ["type", "data"],
		},
		{
			type: "object",
			properties: {
				type: { const: "error" },
				message: { type: "string" },
				code: { type: "integer" },
			},
			required: ["type", "message"],
		},
	],
};

const flexibleInput: JSONSchema7 = {
	type: "object",
	properties: {
		type: { type: "string" },
	},
	required: ["type"],
};

// ─── Paginated Output → Expected Input ───────────────────────────────────────

const paginatedOutput: JSONSchema7 = {
	type: "object",
	properties: {
		items: {
			type: "array",
			items: {
				type: "object",
				properties: {
					id: { type: "integer", minimum: 1 },
					name: { type: "string", minLength: 1, maxLength: 255 },
					tags: {
						type: "array",
						items: { type: "string" },
						uniqueItems: true,
					},
				},
				required: ["id", "name"],
			},
		},
		page: { type: "integer", minimum: 1 },
		pageSize: { type: "integer", minimum: 1, maximum: 100 },
		totalPages: { type: "integer", minimum: 0 },
	},
	required: ["items", "page", "pageSize", "totalPages"],
};

const paginatedInput: JSONSchema7 = {
	type: "object",
	properties: {
		items: {
			type: "array",
			items: {
				type: "object",
				properties: {
					id: { type: "number" },
					name: { type: "string" },
				},
				required: ["id"],
			},
		},
		page: { type: "number" },
		totalPages: { type: "number" },
	},
	required: ["items"],
};

// ─── Not + AdditionalProperties + Format (integration) ───────────────────────

const closedSource: JSONSchema7 = {
	type: "object",
	properties: {
		status: { type: "string", const: "active" },
		email: { type: "string", format: "email" },
	},
	required: ["status", "email"],
	additionalProperties: false,
};

const notTarget: JSONSchema7 = {
	type: "object",
	properties: {
		status: { type: "string", not: { const: "deleted" } },
		email: { type: "string", format: "email" },
	},
	required: ["status"],
};

// ─── Conditional Form Schema ─────────────────────────────────────────────────

const conditionalFormSchema: JSONSchema7 = {
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

// ─── All-keywords complex schema ─────────────────────────────────────────────

const allKeywordsSchema: JSONSchema7 = {
	type: "object",
	properties: {
		name: {
			type: "string",
			minLength: 1,
			maxLength: 100,
			pattern: "^[A-Z]",
		},
		age: {
			type: "integer",
			minimum: 0,
			maximum: 150,
			exclusiveMinimum: -1,
		},
		email: { type: "string", format: "email" },
		tags: {
			type: "array",
			items: { type: "string", minLength: 1 },
			minItems: 0,
			maxItems: 10,
			uniqueItems: true,
		},
		metadata: {
			type: "object",
			properties: {
				created: { type: "string", format: "date-time" },
			},
			additionalProperties: { type: "string" },
		},
	},
	required: ["name", "email"],
	additionalProperties: false,
	minProperties: 2,
	maxProperties: 10,
	propertyNames: { minLength: 1 },
};

// ─── Deep nesting stress ─────────────────────────────────────────────────────

function makeDeep(
	depth: number,
	extra: Partial<JSONSchema7> = {},
): JSONSchema7 {
	if (depth === 0) return { type: "string", ...extra };
	return {
		type: "object",
		properties: { child: makeDeep(depth - 1, extra) },
		required: ["child"],
	};
}

const deep5Strict = makeDeep(5, { minLength: 1 });
const deep5Loose = makeDeep(5);
const deep8Strict = makeDeep(8, { minLength: 1 });
const deep8Loose = makeDeep(8);

// ─── Wide schema stress ──────────────────────────────────────────────────────

function makeWide(
	count: number,
	extra: Partial<JSONSchema7> = {},
): JSONSchema7 {
	const properties: Record<string, JSONSchema7> = {};
	const required: string[] = [];
	for (let i = 0; i < count; i++) {
		properties[`prop_${i}`] = { type: "string", ...extra };
		required.push(`prop_${i}`);
	}
	return { type: "object", properties, required };
}

const wide10 = makeWide(10);
const wide10Strict = makeWide(10, { minLength: 1 });
const wide30 = makeWide(30);
const wide30Strict = makeWide(30, { minLength: 1 });
const wide50 = makeWide(50);
const wide50Strict = makeWide(50, { minLength: 1 });

// ─── allOf + if/then/else combined resolution ────────────────────────────────

const allOfConditionalSchema: JSONSchema7 = {
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

// ─── Nested conditional config ───────────────────────────────────────────────

const nestedConditionalConfig: JSONSchema7 = {
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

// ─── Double negation + subset ────────────────────────────────────────────────

const doubleNegation: JSONSchema7 = {
	not: { not: { type: "string", minLength: 3 } },
};
const plainString: JSONSchema7 = { type: "string" };

// ─── Format hierarchy chains ─────────────────────────────────────────────────

const formatEmail: JSONSchema7 = { type: "string", format: "email" };
const formatIdnEmail: JSONSchema7 = { type: "string", format: "idn-email" };
const formatUri: JSONSchema7 = { type: "string", format: "uri" };
const formatIri: JSONSchema7 = { type: "string", format: "iri" };
const formatHostname: JSONSchema7 = { type: "string", format: "hostname" };
const formatIdnHostname: JSONSchema7 = {
	type: "string",
	format: "idn-hostname",
};

// ─── Runtime constraints scenarios ────────────────────────────────────────────

const constrainedUserOutput: JSONSchema7 = {
	type: "object",
	properties: {
		id: { type: "string", constraints: ["IsUuid"] },
		age: {
			type: "number",
			constraints: [{ name: "MinAge", params: { min: 18 } }],
		},
		email: { type: "string", constraints: ["IsCompanyEmail"] },
	},
	required: ["id", "age", "email"],
};

const unconstrainedUserInput: JSONSchema7 = {
	type: "object",
	properties: {
		id: { type: "string" },
		age: { type: "number" },
		email: { type: "string" },
	},
	required: ["id", "age", "email"],
};

const validConstrainedUserData = {
	id: "550e8400-e29b-41d4-a716-446655440000",
	age: 29,
	email: "jane@acme.com",
};

const invalidConstrainedUserData = {
	id: "not-a-uuid",
	age: 15,
	email: "jane@example.com",
};

const mixedConstraintSchema: JSONSchema7 = {
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

const validMixedConstraintData = {
	accountId: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
	owner: {
		email: "owner@acme.com",
		age: 34,
	},
};

const invalidMixedConstraintData = {
	accountId: "bad-id",
	owner: {
		email: "owner@example.com",
		age: 18,
	},
};

// ═══════════════════════════════════════════════════════════════════════════════
//  Benchmarks — End-to-End Real World Scenarios
// ═══════════════════════════════════════════════════════════════════════════════

// ─── check: Node Orchestration ───────────────────────────────────────────────

summary(() => {
	boxplot(() => {
		bench("check: API response → expected input (compatible)", () =>
			checker.check(apiResponse, expectedInput),
		);
		bench("check: webhook → strict event (incompatible)", () =>
			checker.check(webhookPayload, strictEventSchema),
		);
		bench("check: discriminated union → flexible input", () =>
			checker.check(discriminatedUnionOutput, flexibleInput),
		);
		bench("check: paginated output → expected input", () =>
			checker.check(paginatedOutput, paginatedInput),
		);
		bench("check: closed source + format + not", () =>
			checker.check(closedSource, notTarget),
		);
	});
});

// ─── check with conditions: Conditional Form Schemas ─────────────────────────

summary(() => {
	boxplot(() => {
		bench("check+conditions: business output ⊆ form (resolved)", () =>
			checker.check(businessOutput, conditionalFormSchema, {
				data: { accountType: "business" },
			}),
		);
		bench("check+conditions: personal output ⊆ form (resolved)", () =>
			checker.check(personalOutput, conditionalFormSchema, {
				data: { accountType: "personal" },
			}),
		);
	});
});

summary(() => {
	boxplot(() => {
		bench("constraints: simple valid runtime check", () =>
			checkerWithConstraints.check(
				constrainedUserOutput,
				unconstrainedUserInput,
				{
					data: validConstrainedUserData,
				},
			),
		);
		bench("constraints: simple invalid runtime check", () =>
			checkerWithConstraints.check(
				constrainedUserOutput,
				unconstrainedUserInput,
				{
					data: invalidConstrainedUserData,
				},
			),
		);
		bench("constraints: nested valid runtime check", () =>
			checkerWithConstraints.check(
				mixedConstraintSchema,
				mixedConstraintSchema,
				{
					data: validMixedConstraintData,
				},
			),
		);
		bench("constraints: nested invalid runtime check", () =>
			checkerWithConstraints.check(
				mixedConstraintSchema,
				mixedConstraintSchema,
				{
					data: invalidMixedConstraintData,
				},
			),
		);
	});
});

// ─── resolveConditions: Complex allOf + Nested ───────────────────────────────

summary(() => {
	boxplot(() => {
		bench("resolveConditions: allOf both match", () =>
			resolveConditions(
				allOfConditionalSchema,
				{
					name: "Alice",
					age: 25,
					role: "admin",
				},
				engine,
			),
		);
		bench("resolveConditions: allOf none match", () =>
			resolveConditions(allOfConditionalSchema, { name: "Dave" }, engine),
		);
		bench("resolveConditions: nested config (safe)", () =>
			resolveConditions(
				nestedConditionalConfig,
				{
					config: { mode: "safe" },
				},
				engine,
			),
		);
		bench("resolveConditions: nested config (fast)", () =>
			resolveConditions(
				nestedConditionalConfig,
				{
					config: { mode: "fast" },
				},
				engine,
			),
		);
	});
});

// ─── isSubset: Identity / Self-check ─────────────────────────────────────────

summary(() => {
	boxplot(() => {
		bench("identity: all-keywords schema ⊆ itself", () =>
			checker.isSubset(allKeywordsSchema, allKeywordsSchema),
		);
		bench("identity: API response ⊆ itself", () =>
			checker.isSubset(apiResponse, apiResponse),
		);
		bench("identity: paginated output ⊆ itself", () =>
			checker.isSubset(paginatedOutput, paginatedOutput),
		);
	});
});

// ─── isEqual: Complex Schema Comparison ──────────────────────────────────────

summary(() => {
	boxplot(() => {
		bench("isEqual: all-keywords schema (same ref)", () =>
			checker.isEqual(allKeywordsSchema, allKeywordsSchema),
		);
		bench("isEqual: API response vs expected input (different)", () =>
			checker.isEqual(apiResponse, expectedInput),
		);
		bench("isEqual: normalize + compare (double negation)", () =>
			checker.isEqual(
				checker.normalize(doubleNegation),
				checker.normalize({ type: "string", minLength: 3 }),
			),
		);
	});
});

// ─── intersect: Complex Merges ───────────────────────────────────────────────

summary(() => {
	boxplot(() => {
		bench("intersect: API response ∩ expected input", () =>
			checker.intersect(apiResponse, expectedInput),
		);
		bench("intersect: paginated output ∩ paginated input", () =>
			checker.intersect(paginatedOutput, paginatedInput),
		);
		bench("intersect: all-keywords ∩ itself (idempotent)", () =>
			checker.intersect(allKeywordsSchema, allKeywordsSchema),
		);
	});
});

// ─── Deep Nesting Stress ─────────────────────────────────────────────────────

summary(() => {
	boxplot(() => {
		bench("deep 5-level: strict ⊆ loose", () =>
			checker.isSubset(deep5Strict, deep5Loose),
		);
		bench("deep 5-level: loose ⊄ strict", () =>
			checker.isSubset(deep5Loose, deep5Strict),
		);
		bench("deep 8-level: strict ⊆ loose", () =>
			checker.isSubset(deep8Strict, deep8Loose),
		);
		bench("deep 8-level: loose ⊄ strict", () =>
			checker.isSubset(deep8Loose, deep8Strict),
		);
	});
});

summary(() => {
	boxplot(() => {
		bench("deep 5-level: check (detailed diffs)", () =>
			checker.check(deep5Loose, deep5Strict),
		);
		bench("deep 8-level: check (detailed diffs)", () =>
			checker.check(deep8Loose, deep8Strict),
		);
	});
});

summary(() => {
	boxplot(() => {
		bench("deep 5-level: intersect", () =>
			checker.intersect(deep5Strict, deep5Loose),
		);
		bench("deep 8-level: intersect", () =>
			checker.intersect(deep8Strict, deep8Loose),
		);
	});
});

// ─── Wide Schema Stress ──────────────────────────────────────────────────────

summary(() => {
	boxplot(() => {
		bench("wide 10-prop: strict ⊆ loose", () =>
			checker.isSubset(wide10Strict, wide10),
		);
		bench("wide 30-prop: strict ⊆ loose", () =>
			checker.isSubset(wide30Strict, wide30),
		);
		bench("wide 50-prop: strict ⊆ loose", () =>
			checker.isSubset(wide50Strict, wide50),
		);
	});
});

summary(() => {
	boxplot(() => {
		bench("wide 10-prop: intersect", () =>
			checker.intersect(wide10Strict, wide10),
		);
		bench("wide 30-prop: intersect", () =>
			checker.intersect(wide30Strict, wide30),
		);
		bench("wide 50-prop: intersect", () =>
			checker.intersect(wide50Strict, wide50),
		);
	});
});

summary(() => {
	boxplot(() => {
		bench("wide 10-prop: check", () => checker.check(wide10, wide10Strict));
		bench("wide 30-prop: check", () => checker.check(wide30, wide30Strict));
		bench("wide 50-prop: check", () => checker.check(wide50, wide50Strict));
	});
});

// ─── Format Hierarchy Chains ─────────────────────────────────────────────────

summary(() => {
	boxplot(() => {
		bench("format: email ⊆ idn-email", () =>
			checker.isSubset(formatEmail, formatIdnEmail),
		);
		bench("format: uri ⊆ iri", () => checker.isSubset(formatUri, formatIri));
		bench("format: hostname ⊆ idn-hostname", () =>
			checker.isSubset(formatHostname, formatIdnHostname),
		);
		bench("format: email ∩ email (same)", () =>
			checker.intersect(formatEmail, formatEmail),
		);
		bench("format: email ∩ uri (conflict → null)", () =>
			checker.intersect(formatEmail, formatUri),
		);
	});
});

// ─── Integration: Double Negation + Subset ───────────────────────────────────

summary(() => {
	boxplot(() => {
		bench("double negation: not(not(string)) ⊆ string", () =>
			checker.isSubset(doubleNegation, plainString),
		);
		bench("double negation: normalize", () =>
			checker.normalize(doubleNegation),
		);
	});
});

// ─── Full Pipeline: normalize → check → formatResult ─────────────────────────

summary(() => {
	boxplot(() => {
		bench("pipeline: normalize + isSubset (API response)", () => {
			const n1 = checker.normalize(apiResponse);
			const n2 = checker.normalize(expectedInput);
			checker.isSubset(n1, n2);
		});

		bench("pipeline: check + formatResult (webhook)", () => {
			const result = checker.check(webhookPayload, strictEventSchema);
			checker.formatResult("webhook check", result);
		});

		bench("pipeline: resolveConditions + check (form)", () => {
			const resolved = resolveConditions(
				conditionalFormSchema,
				{
					accountType: "business",
				},
				engine,
			);
			checker.check(businessOutput, resolved.resolved);
		});

		bench("pipeline: normalize + intersect + isEqual (commutativity)", () => {
			const ab = checker.intersect(apiResponse, expectedInput);
			const ba = checker.intersect(expectedInput, apiResponse);
			if (ab && ba) {
				checker.isEqual(checker.normalize(ab), checker.normalize(ba));
			}
		});
	});
});

await run();
