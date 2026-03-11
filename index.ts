import type { JSONSchema7 } from "json-schema";
import { JsonSchemaCompatibilityChecker } from "./src";

const checker = new JsonSchemaCompatibilityChecker({
	constraints: {
		IsUuid: async () => {
			return {
				valid: false,
				message: "Value must be a valid UUID",
			};
		},
	},
});

// ── Original problem scenario ────────────────────────────────────────────────
// closedOutputSchema has `required: ['accountId']` + `additionalProperties: false`
// nodeInputSchema is a loose object with a constrained property
// data is `{}` (partial pipeline context — accountId not yet available)

const closedOutputSchema: JSONSchema7 = {
	type: "object",
	properties: {
		accountId: { type: "string" },
	},
	required: ["accountId"],
	additionalProperties: false,
};

const nodeInputSchema: JSONSchema7 = {
	type: "object",
	properties: {
		accountId: {
			type: "string",
			constraints: "IsUuid",
		},
	},
};

// ── validate: true — fails because {} doesn't satisfy sub's required ─────────
console.log("── validate: true ──");
const resultBoth = await checker.check(closedOutputSchema, nodeInputSchema, {
	data: {},
	validate: true,
});
console.log(JSON.stringify(resultBoth, null, 2));
// → isSubset: false — $sub.accountId error (required but missing in data)

// ── validate: { sup: true } — skips sub validation, only validates sup ───────
console.log("\n── validate: { sup: true } ──");
const resultSupOnly = await checker.check(closedOutputSchema, nodeInputSchema, {
	data: {},
	validate: { sup: true },
});
console.log(JSON.stringify(resultSupOnly, null, 2));
// → isSubset: true — sub validation skipped, sup passes (accountId not required)

// ── validate: { sup: true } with accountId — constraint triggers ─────────────
console.log("\n── validate: { sup: true } with accountId in data ──");
const resultWithData = await checker.check(
	closedOutputSchema,
	nodeInputSchema,
	{
		data: { accountId: "not-a-uuid" },
		validate: { sup: true },
	},
);
console.log(JSON.stringify(resultWithData, null, 2));
// → isSubset: false — IsUuid constraint fails on sup
