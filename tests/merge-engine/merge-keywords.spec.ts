import { beforeAll, describe, expect, test } from "bun:test";
import type { JSONSchema7, JSONSchema7Definition } from "json-schema";
import { JsonSchemaCompatibilityChecker } from "../../src";

let checker: JsonSchemaCompatibilityChecker;

beforeAll(() => {
	checker = new JsonSchemaCompatibilityChecker();
});

// ═══════════════════════════════════════════════════════════════════════════════
//  Merge engine — numeric, string, array, and object keyword handling
// ═══════════════════════════════════════════════════════════════════════════════

describe("merge engine — numeric keywords", () => {
	test("minimum: tighter wins", () => {
		const r = checker.intersect(
			{ type: "number", minimum: 5 },
			{ type: "number", minimum: 10 },
		) as JSONSchema7;
		expect(r.minimum).toBe(10);
	});

	test("maximum: tighter wins", () => {
		const r = checker.intersect(
			{ type: "number", maximum: 100 },
			{ type: "number", maximum: 50 },
		) as JSONSchema7;
		expect(r.maximum).toBe(50);
	});

	test("exclusiveMinimum: tighter wins", () => {
		const r = checker.intersect(
			{ type: "number", exclusiveMinimum: 0 },
			{ type: "number", exclusiveMinimum: 5 },
		) as JSONSchema7;
		expect(r.exclusiveMinimum).toBe(5);
	});

	test("exclusiveMaximum: tighter wins", () => {
		const r = checker.intersect(
			{ type: "number", exclusiveMaximum: 100 },
			{ type: "number", exclusiveMaximum: 50 },
		) as JSONSchema7;
		expect(r.exclusiveMaximum).toBe(50);
	});

	test("minimum from one side + maximum from the other → both kept", () => {
		const r = checker.intersect(
			{ type: "number", minimum: 5 },
			{ type: "number", maximum: 100 },
		) as JSONSchema7;
		expect(r.minimum).toBe(5);
		expect(r.maximum).toBe(100);
	});

	test("multipleOf: stricter preserved (6 ∩ 3)", () => {
		const r = checker.intersect(
			{ type: "integer", multipleOf: 6 },
			{ type: "integer", multipleOf: 3 },
		) as JSONSchema7;
		// multipleOf 6 is a subset of multipleOf 3, merged should keep 6
		expect(r.multipleOf).toBe(6);
	});

	test("multipleOf: from one side only → preserved", () => {
		const r = checker.intersect(
			{ type: "integer", multipleOf: 5 },
			{ type: "integer" },
		) as JSONSchema7;
		expect(r.multipleOf).toBe(5);
	});
});

describe("merge engine — string keywords", () => {
	test("minLength: tighter wins", () => {
		const r = checker.intersect(
			{ type: "string", minLength: 1 },
			{ type: "string", minLength: 5 },
		) as JSONSchema7;
		expect(r.minLength).toBe(5);
	});

	test("maxLength: tighter wins", () => {
		const r = checker.intersect(
			{ type: "string", maxLength: 100 },
			{ type: "string", maxLength: 50 },
		) as JSONSchema7;
		expect(r.maxLength).toBe(50);
	});

	test("pattern from one side → preserved", () => {
		const r = checker.intersect(
			{ type: "string", pattern: "^[A-Z]" },
			{ type: "string", minLength: 1 },
		) as JSONSchema7;
		expect(r.pattern).toBe("^[A-Z]");
		expect(r.minLength).toBe(1);
	});

	test("format from one side → preserved", () => {
		const r = checker.intersect(
			{ type: "string", format: "email" },
			{ type: "string" },
		) as JSONSchema7;
		expect(r.format).toBe("email");
	});

	test("all string keywords combined", () => {
		const r = checker.intersect(
			{ type: "string", minLength: 3, pattern: "^[a-z]+$" },
			{ type: "string", maxLength: 20, format: "hostname" },
		) as JSONSchema7;
		expect(r.minLength).toBe(3);
		expect(r.maxLength).toBe(20);
		expect(r.pattern).toBe("^[a-z]+$");
		expect(r.format).toBe("hostname");
	});
});

describe("merge engine — array keywords", () => {
	test("minItems: tighter wins", () => {
		const r = checker.intersect(
			{ type: "array", minItems: 1 },
			{ type: "array", minItems: 3 },
		) as JSONSchema7;
		expect(r.minItems).toBe(3);
	});

	test("maxItems: tighter wins", () => {
		const r = checker.intersect(
			{ type: "array", maxItems: 10 },
			{ type: "array", maxItems: 5 },
		) as JSONSchema7;
		expect(r.maxItems).toBe(5);
	});

	test("uniqueItems: true wins over absent", () => {
		const r = checker.intersect(
			{ type: "array", uniqueItems: true },
			{ type: "array" },
		) as JSONSchema7;
		expect(r.uniqueItems).toBe(true);
	});

	test("items (single schema): schemas are merged", () => {
		const r = checker.intersect(
			{ type: "array", items: { type: "string" } },
			{ type: "array", items: { type: "string", minLength: 3 } },
		) as JSONSchema7;
		const items = r.items as JSONSchema7;
		expect(items.type).toBe("string");
		expect(items.minLength).toBe(3);
	});

	test("items from one side + array constraints from the other → both kept", () => {
		const r = checker.intersect(
			{ type: "array", items: { type: "number" } },
			{ type: "array", minItems: 1, maxItems: 10, uniqueItems: true },
		) as JSONSchema7;
		expect((r.items as JSONSchema7).type).toBe("number");
		expect(r.minItems).toBe(1);
		expect(r.maxItems).toBe(10);
		expect(r.uniqueItems).toBe(true);
	});

	test("tuple items: merged by index", () => {
		const r = checker.intersect(
			{ type: "array", items: [{ type: "string" }, { type: "number" }] },
			{
				type: "array",
				items: [
					{ type: "string", minLength: 1 },
					{ type: "number", minimum: 0 },
				],
			},
		) as JSONSchema7;
		const items = r.items as JSONSchema7[];
		expect((items[0] as JSONSchema7).type).toBe("string");
		expect((items[0] as JSONSchema7).minLength).toBe(1);
		expect((items[1] as JSONSchema7).type).toBe("number");
		expect((items[1] as JSONSchema7).minimum).toBe(0);
	});
});

describe("merge engine — object keywords", () => {
	test("required: union of both sides", () => {
		const r = checker.intersect(
			{ type: "object", required: ["a", "b"] },
			{ type: "object", required: ["b", "c"] },
		) as JSONSchema7;
		expect(r.required).toContain("a");
		expect(r.required).toContain("b");
		expect(r.required).toContain("c");
	});

	test("required: deduplicated", () => {
		const r = checker.intersect(
			{ type: "object", required: ["a", "b"] },
			{ type: "object", required: ["a", "b"] },
		) as JSONSchema7;
		const count = r.required?.filter((k) => k === "a").length;
		expect(count).toBe(1);
	});

	test("properties: disjoint properties are combined", () => {
		const r = checker.intersect(
			{ type: "object", properties: { a: { type: "string" } } },
			{ type: "object", properties: { b: { type: "number" } } },
		) as JSONSchema7;
		expect(r.properties).toHaveProperty("a");
		expect(r.properties).toHaveProperty("b");
	});

	test("properties: overlapping property schemas are merged", () => {
		const r = checker.intersect(
			{ type: "object", properties: { x: { type: "string" } } },
			{ type: "object", properties: { x: { type: "string", minLength: 3 } } },
		) as JSONSchema7;
		const x = r.properties?.x as JSONSchema7;
		expect(x.type).toBe("string");
		expect(x.minLength).toBe(3);
	});

	test("additionalProperties: false ∩ true → false", () => {
		const r = checker.intersect(
			{ type: "object", additionalProperties: false },
			{ type: "object", additionalProperties: true },
		) as JSONSchema7;
		expect(r.additionalProperties).toBe(false);
	});

	test("additionalProperties: schema ∩ schema → merged schema", () => {
		const r = checker.intersect(
			{ type: "object", additionalProperties: { type: "string" } },
			{
				type: "object",
				additionalProperties: { type: "string", minLength: 1 },
			},
		) as JSONSchema7;
		const addProps = r.additionalProperties as JSONSchema7;
		expect(addProps.type).toBe("string");
		expect(addProps.minLength).toBe(1);
	});

	test("patternProperties: same pattern → schemas merged", () => {
		const r = checker.intersect(
			{ type: "object", patternProperties: { "^S_": { type: "string" } } },
			{
				type: "object",
				patternProperties: { "^S_": { type: "string", minLength: 1 } },
			},
		) as JSONSchema7;
		const pp = r.patternProperties?.["^S_"] as JSONSchema7;
		expect(pp.type).toBe("string");
		expect(pp.minLength).toBe(1);
	});

	test("patternProperties: different patterns → both kept", () => {
		const r = checker.intersect(
			{ type: "object", patternProperties: { "^A_": { type: "string" } } },
			{ type: "object", patternProperties: { "^B_": { type: "number" } } },
		) as JSONSchema7;
		expect(r.patternProperties).toHaveProperty("^A_");
		expect(r.patternProperties).toHaveProperty("^B_");
	});

	test("minProperties: tighter wins", () => {
		const r = checker.intersect(
			{ type: "object", minProperties: 1 },
			{ type: "object", minProperties: 3 },
		) as JSONSchema7;
		expect(r.minProperties).toBe(3);
	});

	test("maxProperties: tighter wins", () => {
		const r = checker.intersect(
			{ type: "object", maxProperties: 10 },
			{ type: "object", maxProperties: 5 },
		) as JSONSchema7;
		expect(r.maxProperties).toBe(5);
	});

	test("dependencies (array form): merged as union", () => {
		const r = checker.intersect(
			{ type: "object", dependencies: { a: ["b"] } },
			{ type: "object", dependencies: { a: ["c"] } },
		) as JSONSchema7;
		const deps = r.dependencies as Record<string, string[]>;
		expect(deps.a).toContain("b");
		expect(deps.a).toContain("c");
	});

	test("dependencies (schema form): schemas are merged", () => {
		const r = checker.intersect(
			{ type: "object", dependencies: { a: { required: ["b"] } } },
			{ type: "object", dependencies: { a: { required: ["c"] } } },
		) as JSONSchema7;
		const dep = (r.dependencies as Record<string, JSONSchema7Definition>)
			.a as JSONSchema7;
		expect(dep.required).toContain("b");
		expect(dep.required).toContain("c");
	});

	test("dependencies: disjoint keys → both kept", () => {
		const r = checker.intersect(
			{ type: "object", dependencies: { a: ["b"] } },
			{ type: "object", dependencies: { x: ["y"] } },
		) as JSONSchema7;
		const deps = r.dependencies as Record<string, string[]>;
		expect(deps.a).toEqual(["b"]);
		expect(deps.x).toEqual(["y"]);
	});
});
