import type { JSONSchema7 } from "json-schema";
import { JsonSchemaCompatibilityChecker } from "./src";

const checker = new JsonSchemaCompatibilityChecker();

const schema: JSONSchema7 = {
	type: "string",
};

const schema2: JSONSchema7 = {
	type: "integer",
};

const result = checker.canConnect(schema, schema2);
console.log(result);
