import type { JSONSchema7 } from "json-schema";
import { JsonSchemaCompatibilityChecker } from "./src";

const checker = new JsonSchemaCompatibilityChecker({
	// constraints: {
	//   "IsUuid": () => {
	//     console.log('ok')
	//     return {
	//       valid: false,
	//       message: "ok"
	//     }
	//   }
	// }
});

const sub = {
	type: "object",
	properties: {
		name: {
			type: "string",
			format: "uuid",
		},
	},
} satisfies JSONSchema7;

const sup = {
	type: "object",
	properties: {
		name: {
			type: "string",
			format: "uuid",
		},
	},
} satisfies JSONSchema7;

const result = await checker.check(sub, sup, {
	data: {
		name: crypto.randomUUID(),
	},
	validate: {
		sup: {
			partial: true,
		},
	},
});

console.log(result);
