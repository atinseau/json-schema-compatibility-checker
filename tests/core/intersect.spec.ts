import { beforeAll, describe, expect, test } from "bun:test";
import type { JSONSchema7 } from "json-schema";
import { JsonSchemaCompatibilityChecker } from "../../src";

let checker: JsonSchemaCompatibilityChecker;

beforeAll(() => {
	checker = new JsonSchemaCompatibilityChecker();
});

// ─────────────────────────────────────────────────────────────────────────────
//  intersect
// ─────────────────────────────────────────────────────────────────────────────

describe("intersect", () => {
	test("intersection of compatible schemas returns merged result", () => {
		const result = checker.intersect(
			{ type: "number", minimum: 5, maximum: 10 },
			{ type: "number", minimum: 0, maximum: 100 },
		);

		expect(result).not.toBeNull();
		expect(typeof result).toBe("object");
		const schema = result as JSONSchema7;
		expect(schema.type).toBe("number");
		expect(schema.minimum).toBe(5);
		expect(schema.maximum).toBe(10);
	});

	test("intersection of incompatible types returns null", () => {
		expect(
			checker.intersect({ type: "string" }, { type: "number" }),
		).toBeNull();
	});

	test("intersection tightens constraints from both sides", () => {
		const result = checker.intersect(
			{ type: "string", minLength: 3 },
			{ type: "string", maxLength: 10 },
		);

		expect(result).not.toBeNull();
		const schema = result as JSONSchema7;
		expect(schema.minLength).toBe(3);
		expect(schema.maxLength).toBe(10);
	});

	test("intersection of object schemas merges properties", () => {
		const result = checker.intersect(
			{
				type: "object",
				properties: { a: { type: "string" } },
				required: ["a"],
			},
			{
				type: "object",
				properties: { b: { type: "number" } },
				required: ["b"],
			},
		);

		expect(result).not.toBeNull();
		const schema = result as JSONSchema7;
		expect(schema.properties).toHaveProperty("a");
		expect(schema.properties).toHaveProperty("b");
		expect(schema.required).toContain("a");
		expect(schema.required).toContain("b");
	});

	test("intersection of enums returns common values", () => {
		const result = checker.intersect(
			{ type: "string", enum: ["a", "b", "c"] },
			{ type: "string", enum: ["b", "c", "d"] },
		);

		expect(result).not.toBeNull();
		const schema = result as JSONSchema7;
		expect(schema.enum).toEqual(["b", "c"]);
	});

	test("intersection of integer and number yields integer", () => {
		const result = checker.intersect({ type: "integer" }, { type: "number" });

		expect(result).not.toBeNull();
		const schema = result as JSONSchema7;
		expect(schema.type).toBe("integer");
	});

	test("intersection with boolean true returns the other schema", () => {
		const schema: JSONSchema7 = { type: "string", minLength: 1 };
		const result = checker.intersect(schema, true);

		expect(result).not.toBeNull();
		expect((result as JSONSchema7).type).toBe("string");
	});

	test("intersection with boolean false returns false", () => {
		const result = checker.intersect({ type: "string" }, false);

		expect(result).not.toBeNull();
		expect(result).toBe(false);
	});
});
