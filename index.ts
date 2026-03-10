import type { JSONSchema7 } from "json-schema";
import { JsonSchemaCompatibilityChecker, MergeEngine } from "./src";

const _merge = new MergeEngine();

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

const schema1: JSONSchema7 = {
	type: "string",
	constraints: ["IsUuid"],
};

const schema2: JSONSchema7 = {
	type: "string",
};

const result = await checker.check(schema1, schema2, {
	data: "Salut !",
	validate: true,
});

console.log(JSON.stringify(result, null, 2));
