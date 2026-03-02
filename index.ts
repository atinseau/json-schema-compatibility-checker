import type { JSONSchema7 } from "json-schema";
import { JsonSchemaCompatibilityChecker } from "./src";

const checker = new JsonSchemaCompatibilityChecker();

const schema1: JSONSchema7 = {
	type: "string",
	enum: ["red", "green", "blue"],
};

const schema2: JSONSchema7 = {
	type: "string",
};

const result = checker.check(schema2, schema1, {
	subData: {},
});
console.log(result);
