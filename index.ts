import type { JSONSchema7 } from "json-schema";
import { JsonSchemaCompatibilityChecker } from "./src";

const checker = new JsonSchemaCompatibilityChecker();

const schema: JSONSchema7 = {
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

const resolvedConditionResult = checker.resolveConditions(schema, {
	name: "Alice",
	age: 25,
	role: "admin",
});

console.log(resolvedConditionResult.resolved);
