import { beforeAll, describe, expect, test } from "bun:test";
import type { JSONSchema7 } from "json-schema";
import { JsonSchemaCompatibilityChecker } from "../../src";

let checker: JsonSchemaCompatibilityChecker;

beforeAll(() => {
	checker = new JsonSchemaCompatibilityChecker();
});

// ── Runtime Validator LRU Cache ──────────────────────────────────────────────

describe("runtime validator string cache (LRU bounded)", () => {
	test("runtime validation works correctly after many distinct schemas (LRU eviction)", () => {
		// Generate more schemas than the LRU cache size to trigger eviction
		for (let i = 0; i < 600; i++) {
			const schema: JSONSchema7 = { type: "number", minimum: i };
			const result = checker.check(schema, schema, {
				data: i + 1,
				validate: true,
			});
			expect(result.isSubset).toBe(true);
		}

		// After eviction, re-validating an early schema should still work
		const earlySchema: JSONSchema7 = { type: "number", minimum: 0 };
		const result = checker.check(earlySchema, earlySchema, {
			data: 1,
			validate: true,
		});
		expect(result.isSubset).toBe(true);
	});

	test("validation results are correct regardless of cache state", () => {
		const schema: JSONSchema7 = { type: "string", minLength: 3 };

		// First call — compiles and caches
		const r1 = checker.check(schema, schema, { data: "hello", validate: true });
		expect(r1.isSubset).toBe(true);

		// Second call with same schema structure but different object — hits string cache
		const schemaCopy: JSONSchema7 = { type: "string", minLength: 3 };
		const r2 = checker.check(schemaCopy, schemaCopy, {
			data: "hi",
			validate: true,
		});
		expect(r2.isSubset).toBe(false);

		// Third call — invalid data type
		const r3 = checker.check(schema, schema, { data: 42, validate: true });
		expect(r3.isSubset).toBe(false);
	});
});

// ── clearCache() static method ───────────────────────────────────────────────

describe("JsonSchemaCompatibilityChecker.clearCache()", () => {
	test("clearCache does not throw", () => {
		expect(() => JsonSchemaCompatibilityChecker.clearCache()).not.toThrow();
	});

	test("validation still works correctly after clearCache", () => {
		const schema: JSONSchema7 = { type: "string", minLength: 3 };

		// Warm the cache
		const r1 = checker.check(schema, schema, { data: "hello", validate: true });
		expect(r1.isSubset).toBe(true);

		// Clear all caches
		JsonSchemaCompatibilityChecker.clearCache();

		// Validation must still produce correct results (recompiles from scratch)
		const r2 = checker.check(schema, schema, { data: "hello", validate: true });
		expect(r2.isSubset).toBe(true);

		const r3 = checker.check(schema, schema, { data: "hi", validate: true });
		expect(r3.isSubset).toBe(false);
	});

	test("clearCache is callable multiple times without side effects", () => {
		JsonSchemaCompatibilityChecker.clearCache();
		JsonSchemaCompatibilityChecker.clearCache();
		JsonSchemaCompatibilityChecker.clearCache();

		const schema: JSONSchema7 = { type: "number", minimum: 0 };
		const result = checker.check(schema, schema, { data: 5, validate: true });
		expect(result.isSubset).toBe(true);
	});

	test("clearCache affects all checker instances (shared singleton)", () => {
		const checker1 = new JsonSchemaCompatibilityChecker();
		const checker2 = new JsonSchemaCompatibilityChecker();
		const schema: JSONSchema7 = { type: "string", maxLength: 10 };

		// Warm cache via checker1
		const r1 = checker1.check(schema, schema, { data: "abc", validate: true });
		expect(r1.isSubset).toBe(true);

		// Clear via static method
		JsonSchemaCompatibilityChecker.clearCache();

		// checker2 must still work (recompiles)
		const r2 = checker2.check(schema, schema, { data: "abc", validate: true });
		expect(r2.isSubset).toBe(true);

		// checker1 must also still work after clear
		const r3 = checker1.check(schema, schema, { data: "abc", validate: true });
		expect(r3.isSubset).toBe(true);
	});

	test("condition resolution works after clearCache", () => {
		const schema: JSONSchema7 = {
			type: "object",
			properties: {
				mode: { type: "string" },
				value: { type: "string" },
			},
			required: ["mode", "value"],
			if: {
				properties: { mode: { const: "strict" } },
				required: ["mode"],
			},
			then: {
				properties: { value: { type: "string", minLength: 5 } },
			},
		};

		// Warm cache via condition resolution path
		const r1 = checker.check(schema, schema, {
			data: { mode: "strict", value: "hello world" },
			validate: true,
		});
		expect(r1.isSubset).toBe(true);

		// Clear all caches
		JsonSchemaCompatibilityChecker.clearCache();

		// Condition resolution must still work correctly after clear
		const r2 = checker.check(schema, schema, {
			data: { mode: "strict", value: "hello world" },
			validate: true,
		});
		expect(r2.isSubset).toBe(true);

		// And still correctly detect violations
		const r3 = checker.check(schema, schema, {
			data: { mode: "strict", value: "hi" },
			validate: true,
		});
		expect(r3.isSubset).toBe(false);
	});
});
