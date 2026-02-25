import { beforeAll, describe, expect, test } from "bun:test";
import type { JSONSchema7 } from "json-schema";
import { JsonSchemaCompatibilityChecker } from "../../src";

let checker: JsonSchemaCompatibilityChecker;

beforeAll(() => {
	checker = new JsonSchemaCompatibilityChecker();
});

// ─────────────────────────────────────────────────────────────────────────────
//  check (detailed result)
// ─────────────────────────────────────────────────────────────────────────────

describe("check", () => {
	test("returns isSubset: true and empty errors when compatible", () => {
		const result = checker.check(
			{ type: "string", minLength: 5 },
			{ type: "string" },
		);
		expect(result.isSubset).toBe(true);
		expect(result.errors).toEqual([]);
		expect(result.merged).not.toBeNull();
	});

	test("returns isSubset: false and meaningful errors for missing required", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: { name: { type: "string" } },
			required: ["name"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				name: { type: "string" },
				age: { type: "number" },
			},
			required: ["name", "age"],
		};
		const result = checker.check(sub, sup);

		expect(result.isSubset).toBe(false);
		expect(result.errors.length).toBeGreaterThan(0);

		// Should report that 'age' is missing
		const ageError = result.errors.find((e) => e.key === "age");
		expect(ageError).toBeDefined();
		expect(ageError?.expected).toBe("number");
		expect(ageError?.received).toBe("undefined");
	});

	test("returns incompatible error for conflicting types", () => {
		const result = checker.check({ type: "string" }, { type: "number" });

		expect(result.isSubset).toBe(false);
		expect(result.merged).toBeNull();
		expect(result.errors.length).toBeGreaterThanOrEqual(1);

		// Should report a type mismatch at the root level
		const rootError = result.errors[0];
		expect(rootError).toBeDefined();
		expect(rootError?.expected).toBe("number");
		expect(rootError?.received).toBe("string");
	});

	test("error path traces through nested objects", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				user: {
					type: "object",
					properties: {
						profile: {
							type: "object",
							properties: { name: { type: "string" } },
							required: ["name"],
						},
					},
					required: ["profile"],
				},
			},
			required: ["user"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				user: {
					type: "object",
					properties: {
						profile: {
							type: "object",
							properties: {
								name: { type: "string" },
								bio: { type: "string" },
							},
							required: ["name", "bio"],
						},
					},
					required: ["profile"],
				},
			},
			required: ["user"],
		};
		const result = checker.check(sub, sup);

		expect(result.isSubset).toBe(false);

		// Should report missing 'bio' with a normalized path
		const bioError = result.errors.find((e) => e.key === "user.profile.bio");
		expect(bioError).toBeDefined();
		expect(bioError?.expected).toBe("string");
		expect(bioError?.received).toBe("undefined");
	});

	test("reports error for additionalProperties constraint", () => {
		const open: JSONSchema7 = {
			type: "object",
			properties: {
				name: { type: "string" },
				age: { type: "number" },
			},
			required: ["name"],
		};
		const closed: JSONSchema7 = {
			type: "object",
			properties: { name: { type: "string" } },
			required: ["name"],
			additionalProperties: false,
		};
		const result = checker.check(open, closed);

		expect(result.isSubset).toBe(false);
		expect(result.errors.length).toBeGreaterThan(0);
	});

	test("reports error for numeric constraint changes", () => {
		const result = checker.check(
			{ type: "number", minimum: 0, maximum: 100 },
			{ type: "number", minimum: 5, maximum: 10 },
		);

		expect(result.isSubset).toBe(false);
		expect(result.errors.length).toBeGreaterThan(0);
	});

	test("errors for anyOf branch rejection", () => {
		const sub: JSONSchema7 = {
			anyOf: [{ type: "string" }, { type: "number" }, { type: "boolean" }],
		};
		const sup: JSONSchema7 = {
			anyOf: [{ type: "string" }, { type: "number" }],
		};
		const result = checker.check(sub, sup);

		expect(result.isSubset).toBe(false);
		expect(result.errors.length).toBeGreaterThan(0);

		// Should report that boolean is not accepted
		const boolError = result.errors.find((e) => e.received === "boolean");
		expect(boolError).toBeDefined();
	});

	test("errors for anyOf superset with no matching branch", () => {
		const result = checker.check(
			{ type: "boolean" },
			{ anyOf: [{ type: "string" }, { type: "number" }] },
		);

		expect(result.isSubset).toBe(false);
		expect(result.errors.length).toBeGreaterThanOrEqual(1);
		// Should report a type mismatch
		const error = result.errors[0];
		expect(error).toBeDefined();
		expect(error?.received).toBe("boolean");
	});

	test("enum error shows mismatched values", () => {
		const result = checker.check(
			{ type: "string", enum: ["a", "b", "c", "d"] },
			{ type: "string", enum: ["a", "b"] },
		);
		expect(result.isSubset).toBe(false);

		const enumError = result.errors.find(
			(e) => e.expected.includes("a") && e.expected.includes("b"),
		);
		expect(enumError).toBeDefined();
		expect(enumError?.expected).toBe("a or b");
		expect(enumError?.received).toBe("a, b, c, or d");
	});

	test("pattern added shows as error", () => {
		const result = checker.check(
			{ type: "string", minLength: 1 },
			{ type: "string", minLength: 1, pattern: "^[a-z]+$" },
		);
		expect(result.isSubset).toBe(false);
		expect(result.errors.length).toBeGreaterThan(0);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
//  formatResult
// ─────────────────────────────────────────────────────────────────────────────

describe("formatResult", () => {
	test("formats a passing result with ✅ icon", () => {
		const result = checker.check({ type: "string" }, { type: "string" });
		const formatted = checker.formatResult("test label", result);

		expect(formatted).toContain("✅");
		expect(formatted).toContain("test label");
		expect(formatted).toContain("true");
		expect(formatted).not.toContain("Errors");
	});

	test("formats a failing result with ❌ icon and errors", () => {
		const result = checker.check(
			{ type: "number", minimum: 0, maximum: 100 },
			{ type: "number", minimum: 5, maximum: 10 },
		);
		const formatted = checker.formatResult("range check", result);

		expect(formatted).toContain("❌");
		expect(formatted).toContain("range check");
		expect(formatted).toContain("false");
		expect(formatted).toContain("Errors");
	});

	test("formats errors with ✗ prefix", () => {
		const result = checker.check(
			{
				type: "object",
				properties: { name: { type: "string" } },
				required: ["name"],
			},
			{
				type: "object",
				properties: {
					name: { type: "string" },
					age: { type: "number" },
				},
				required: ["name", "age"],
			},
		);
		const formatted = checker.formatResult("label", result);

		expect(formatted).toContain("✗");
		expect(formatted).toContain("expected");
		expect(formatted).toContain("received");
	});

	test("formats incompatible type error", () => {
		const result = checker.check({ type: "string" }, { type: "number" });
		const formatted = checker.formatResult("type clash", result);

		expect(formatted).toContain("❌");
		expect(formatted).toContain("Errors");
		expect(formatted).toContain("number");
		expect(formatted).toContain("string");
	});
});
