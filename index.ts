import type { JSONSchema7 } from "json-schema";
import { MergeEngine } from "./src";

const engine = new MergeEngine();

const schema1: JSONSchema7 = {
	type: "string",
	enum: ["red", "green", "blue"],
};

const schema2: JSONSchema7 = {
	type: "string",
};

const m1 = engine.mergeOrThrow(schema1, schema2);

console.log(m1);
