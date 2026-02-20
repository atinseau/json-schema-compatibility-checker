import type { JSONSchema7 } from "json-schema";
import { bench, boxplot, run, summary } from "mitata";
import { JsonSchemaCompatibilityChecker } from "../src";

const checker = new JsonSchemaCompatibilityChecker();

// ─── Compatible: strict output → loose input ─────────────────────────────────

const orderOutput: JSONSchema7 = {
	type: "object",
	properties: {
		order: {
			type: "object",
			properties: {
				id: { type: "string" },
				total: { type: "number", minimum: 0 },
				items: {
					type: "array",
					items: {
						type: "object",
						properties: {
							sku: { type: "string" },
							qty: { type: "integer", minimum: 1 },
							price: { type: "number", minimum: 0 },
						},
						required: ["sku", "qty", "price"],
					},
					minItems: 1,
				},
				customer: {
					type: "object",
					properties: {
						email: { type: "string", format: "email" },
						name: { type: "string" },
					},
					required: ["email", "name"],
				},
			},
			required: ["id", "total", "items", "customer"],
		},
	},
	required: ["order"],
};

const orderInput: JSONSchema7 = {
	type: "object",
	properties: {
		order: {
			type: "object",
			properties: {
				id: { type: "string" },
				total: { type: "number" },
				customer: {
					type: "object",
					properties: { email: { type: "string" } },
					required: ["email"],
				},
			},
			required: ["id", "total", "customer"],
		},
	},
	required: ["order"],
};

// ─── Compatible: identical schemas ───────────────────────────────────────────

const identicalSchema: JSONSchema7 = {
	type: "object",
	properties: { id: { type: "string" } },
	required: ["id"],
};

// ─── Compatible: empty schemas ───────────────────────────────────────────────

const emptySchema: JSONSchema7 = {};

// ─── Incompatible: type conflict ─────────────────────────────────────────────

const stringValOutput: JSONSchema7 = {
	type: "object",
	properties: { val: { type: "string" } },
	required: ["val"],
};

const numberValInput: JSONSchema7 = {
	type: "object",
	properties: { val: { type: "number" } },
	required: ["val"],
};

// ─── Compatible: API response → expected input ──────────────────────────────

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

// ─── Incompatible: webhook payload → strict event ────────────────────────────

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

// ─── Compatible: discriminated union output → flexible input ─────────────────

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

// ─── Compatible: paginated output → expected input ───────────────────────────

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

// ─── Incompatible: closed output with format ─────────────────────────────────

const closedOutputWithFormat: JSONSchema7 = {
	type: "object",
	properties: {
		status: { type: "string", const: "active" },
		email: { type: "string", format: "email" },
	},
	required: ["status", "email"],
	additionalProperties: false,
};

const targetWithNot: JSONSchema7 = {
	type: "object",
	properties: {
		status: { type: "string", not: { const: "deleted" } },
		email: { type: "string", format: "email" },
	},
	required: ["status"],
};

// ─── Simple schemas ──────────────────────────────────────────────────────────

const simpleStringOutput: JSONSchema7 = {
	type: "object",
	properties: { value: { type: "string", minLength: 1 } },
	required: ["value"],
};

const simpleStringInput: JSONSchema7 = {
	type: "object",
	properties: { value: { type: "string" } },
	required: ["value"],
};

// ─── Reverse direction (incompatible) ────────────────────────────────────────

// Using orderInput as source and orderOutput as target (reverse → should fail)

// ─── Benchmarks ──────────────────────────────────────────────────────────────

summary(() => {
	boxplot(() => {
		bench("simple: string value (compatible)", () =>
			checker.canConnect(simpleStringOutput, simpleStringInput),
		);
		bench("simple: identical schemas (compatible)", () =>
			checker.canConnect(identicalSchema, identicalSchema),
		);
		bench("simple: empty ↔ empty (compatible)", () =>
			checker.canConnect(emptySchema, emptySchema),
		);
		bench("simple: type conflict (incompatible)", () =>
			checker.canConnect(stringValOutput, numberValInput),
		);
	});
});

summary(() => {
	boxplot(() => {
		bench("order: strict output → loose input (compatible)", () =>
			checker.canConnect(orderOutput, orderInput),
		);
		bench("order: loose input → strict output (incompatible, reverse)", () =>
			checker.canConnect(orderInput, orderOutput),
		);
	});
});

summary(() => {
	boxplot(() => {
		bench("real-world: API response → expected input (compatible)", () =>
			checker.canConnect(apiResponse, expectedInput),
		);
		bench("real-world: webhook → strict event (incompatible)", () =>
			checker.canConnect(webhookPayload, strictEventSchema),
		);
	});
});

summary(() => {
	boxplot(() => {
		bench("real-world: discriminated union → flexible input (compatible)", () =>
			checker.canConnect(discriminatedUnionOutput, flexibleInput),
		);
		bench("real-world: paginated output → expected input (compatible)", () =>
			checker.canConnect(paginatedOutput, paginatedInput),
		);
	});
});

summary(() => {
	boxplot(() => {
		bench("integration: closed output + format + not (compatible)", () =>
			checker.canConnect(closedOutputWithFormat, targetWithNot),
		);
	});
});

await run();
