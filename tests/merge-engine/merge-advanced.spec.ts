import { beforeAll, describe, expect, test } from "bun:test";
import type { JSONSchema7 } from "json-schema";
import { JsonSchemaCompatibilityChecker } from "../../src";

let checker: JsonSchemaCompatibilityChecker;

beforeAll(() => {
	checker = new JsonSchemaCompatibilityChecker();
});

// ═══════════════════════════════════════════════════════════════════════════════
//  Merge engine — commutativity, complex realistic schemas, edge cases
// ═══════════════════════════════════════════════════════════════════════════════

describe("merge engine — commutativity", () => {
	test("numeric constraints are commutative", () => {
		const a: JSONSchema7 = { type: "number", minimum: 5, maximum: 50 };
		const b: JSONSchema7 = {
			type: "number",
			minimum: 0,
			maximum: 100,
			multipleOf: 5,
		};
		const ab = checker.intersect(a, b);
		const ba = checker.intersect(b, a);
		expect(ab).not.toBeNull();
		expect(ba).not.toBeNull();
		if (ab && ba) {
			expect(checker.isEqual(ab, ba)).toBe(true);
		}
	});

	test("string constraints are commutative", () => {
		const a: JSONSchema7 = { type: "string", minLength: 3 };
		const b: JSONSchema7 = {
			type: "string",
			maxLength: 10,
			pattern: "^[a-z]+$",
		};
		const ab = checker.intersect(a, b);
		const ba = checker.intersect(b, a);
		expect(ab).not.toBeNull();
		expect(ba).not.toBeNull();
		if (ab && ba) {
			expect(checker.isEqual(ab, ba)).toBe(true);
		}
	});

	test("object properties are commutative", () => {
		const a: JSONSchema7 = {
			type: "object",
			properties: { x: { type: "string" } },
			required: ["x"],
		};
		const b: JSONSchema7 = {
			type: "object",
			properties: { y: { type: "number" } },
			required: ["y"],
		};
		const ab = checker.intersect(a, b);
		const ba = checker.intersect(b, a);
		expect(ab).not.toBeNull();
		expect(ba).not.toBeNull();
		if (ab && ba) {
			expect(checker.isEqual(ab, ba)).toBe(true);
		}
	});

	test("enum intersection is commutative", () => {
		const a: JSONSchema7 = { enum: [1, 2, 3, 4] };
		const b: JSONSchema7 = { enum: [3, 4, 5, 6] };
		const ab = checker.intersect(a, b);
		const ba = checker.intersect(b, a);
		expect(ab).not.toBeNull();
		expect(ba).not.toBeNull();
		if (ab && ba) {
			expect(checker.isEqual(ab, ba)).toBe(true);
		}
	});

	test("array constraints are commutative", () => {
		const a: JSONSchema7 = {
			type: "array",
			items: { type: "string" },
			minItems: 2,
		};
		const b: JSONSchema7 = {
			type: "array",
			items: { type: "string", minLength: 1 },
			maxItems: 10,
		};
		const ab = checker.intersect(a, b);
		const ba = checker.intersect(b, a);
		expect(ab).not.toBeNull();
		expect(ba).not.toBeNull();
		if (ab && ba) {
			expect(checker.isEqual(ab, ba)).toBe(true);
		}
	});
});

describe("merge engine — complex realistic schemas", () => {
	test("full object schema: properties + required + constraints from both sides", () => {
		const r = checker.intersect(
			{
				type: "object",
				properties: {
					name: { type: "string", minLength: 1 },
					tags: { type: "array", items: { type: "string" }, minItems: 1 },
				},
				required: ["name"],
			},
			{
				type: "object",
				properties: {
					name: { type: "string", maxLength: 100 },
					age: { type: "integer", minimum: 0 },
				},
				required: ["name", "age"],
			},
		) as JSONSchema7;

		expect(r).not.toBeNull();
		expect(r.type).toBe("object");
		expect(r.required).toContain("name");
		expect(r.required).toContain("age");

		const nameProp = r.properties?.name as JSONSchema7;
		expect(nameProp.type).toBe("string");
		expect(nameProp.minLength).toBe(1);
		expect(nameProp.maxLength).toBe(100);

		expect(r.properties).toHaveProperty("tags");
		expect(r.properties).toHaveProperty("age");
	});

	test("additionalProperties: false prevents extra properties from the other side", () => {
		// When one schema has additionalProperties: false and the other REQUIRES
		// a property not in the first schema's properties, the intersection is
		// mathematically empty: the required property can never exist (forbidden
		// by additionalProperties: false) yet must exist (required by the other).
		//
		// Case 1: required extra property → intersection is null (empty)
		const r1 = checker.intersect(
			{
				type: "object",
				properties: { name: { type: "string" } },
				additionalProperties: false,
			},
			{
				type: "object",
				properties: { name: { type: "string" }, age: { type: "integer" } },
				required: ["name", "age"],
			},
		);

		expect(r1).toBeNull();

		// Case 2: non-required extra property → intersection exists
		// (the library correctly excludes the non-required extra property)
		const r2 = checker.intersect(
			{
				type: "object",
				properties: { name: { type: "string" } },
				additionalProperties: false,
			},
			{
				type: "object",
				properties: { name: { type: "string" }, age: { type: "integer" } },
			},
		) as JSONSchema7;

		expect(r2).not.toBeNull();
		expect(r2.additionalProperties).toBe(false);
		expect(r2.properties).toHaveProperty("name");
	});

	test("nested objects: both sides contribute constraints at different levels", () => {
		const r = checker.intersect(
			{
				type: "object",
				properties: {
					user: {
						type: "object",
						properties: { email: { type: "string", format: "email" } },
						required: ["email"],
					},
				},
				required: ["user"],
			},
			{
				type: "object",
				properties: {
					user: {
						type: "object",
						properties: {
							email: { type: "string" },
							name: { type: "string" },
						},
						required: ["email", "name"],
					},
				},
				required: ["user"],
			},
		) as JSONSchema7;

		expect(r).not.toBeNull();
		const user = r.properties?.user as JSONSchema7;
		expect(user.required).toContain("email");
		expect(user.required).toContain("name");
		const email = user.properties?.email as JSONSchema7;
		expect(email.type).toBe("string");
		expect(email.format).toBe("email");
	});

	test("array of typed objects with constraints from both sides", () => {
		const r = checker.intersect(
			{
				type: "array",
				items: {
					type: "object",
					properties: { id: { type: "integer" } },
					required: ["id"],
				},
				minItems: 1,
			},
			{
				type: "array",
				items: {
					type: "object",
					properties: { id: { type: "integer", minimum: 1 } },
				},
				maxItems: 100,
				uniqueItems: true,
			},
		) as JSONSchema7;

		expect(r).not.toBeNull();
		expect(r.minItems).toBe(1);
		expect(r.maxItems).toBe(100);
		expect(r.uniqueItems).toBe(true);

		const items = r.items as JSONSchema7;
		expect(items.required).toContain("id");
		const id = items.properties?.id as JSONSchema7;
		expect(id.type).toBe("integer");
		expect(id.minimum).toBe(1);
	});
});

describe("merge engine — commutativity edge cases", () => {
	test("const vs enum — commutative", () => {
		const a: JSONSchema7 = { const: "x" };
		const b: JSONSchema7 = { enum: ["x", "y", "z"] };
		const ab = checker.intersect(a, b);
		const ba = checker.intersect(b, a);
		// Both should be equivalent
		if (ab && ba) {
			expect(
				checker.isEqual(checker.normalize(ab), checker.normalize(ba)),
			).toBe(true);
		}
	});

	test("format conflict is commutative — both directions return null", () => {
		const a: JSONSchema7 = { type: "string", format: "email" };
		const b: JSONSchema7 = { type: "string", format: "ipv4" };
		expect(checker.intersect(a, b)).toBeNull();
		expect(checker.intersect(b, a)).toBeNull();
	});

	test("additionalProperties: false is commutative", () => {
		const a: JSONSchema7 = {
			type: "object",
			properties: { x: { type: "string" } },
			additionalProperties: false,
		};
		const b: JSONSchema7 = {
			type: "object",
			properties: { x: { type: "string" }, y: { type: "number" } },
			required: ["y"],
		};

		const ab = checker.intersect(a, b);
		const ba = checker.intersect(b, a);

		// Both should return null (conflict: y required but additionalProperties: false)
		expect(ab).toBeNull();
		expect(ba).toBeNull();
	});
});
