import { beforeAll, describe, expect, test } from "bun:test";
import type { JSONSchema7 } from "json-schema";
import type { ResolvedSubsetResult } from "../../src";
import { JsonSchemaCompatibilityChecker } from "../../src";

let checker: JsonSchemaCompatibilityChecker;

beforeAll(() => {
	checker = new JsonSchemaCompatibilityChecker();
});

// ── Primitive Narrowing ──────────────────────────────────────────────────────

describe("data narrowing — primitives", () => {
	const sup: JSONSchema7 = {
		type: "string",
		enum: ["red", "green", "blue"],
	};

	test("string value in enum → narrows sub to enum, isSubset = true", () => {
		const sub: JSONSchema7 = { type: "string" };
		const result = checker.check(sub, sup, {
			data: "red",
		}) as ResolvedSubsetResult;

		expect(result.isSubset).toBe(true);
		expect(result.resolvedSub.resolved).toEqual({
			type: "string",
			const: "red",
		});
	});

	test("string value NOT in enum → no narrowing, isSubset = false", () => {
		const sub: JSONSchema7 = { type: "string" };
		const result = checker.check(sub, sup, {
			data: "yellow",
		}) as ResolvedSubsetResult;

		expect(result.isSubset).toBe(false);
		expect(result.resolvedSub.resolved).toEqual({ type: "string" });
	});

	test("numeric value in enum → narrows sub, isSubset = true", () => {
		const numSup: JSONSchema7 = { type: "integer", enum: [1, 2, 3] };
		const numSub: JSONSchema7 = { type: "integer" };
		const result = checker.check(numSub, numSup, {
			data: 2,
		}) as ResolvedSubsetResult;

		expect(result.isSubset).toBe(true);
		expect(result.resolvedSub.resolved).toEqual({
			type: "integer",
			const: 2,
		});
	});

	test("numeric value NOT in enum → no narrowing, isSubset = false", () => {
		const numSup: JSONSchema7 = { type: "integer", enum: [1, 2, 3] };
		const numSub: JSONSchema7 = { type: "integer" };
		const result = checker.check(numSub, numSup, {
			data: 99,
		}) as ResolvedSubsetResult;

		expect(result.isSubset).toBe(false);
		expect(result.resolvedSub.resolved).toEqual({ type: "integer" });
	});

	test("boolean value in enum → narrows sub, isSubset = true", () => {
		const boolSup: JSONSchema7 = { type: "boolean", enum: [true] };
		const boolSub: JSONSchema7 = { type: "boolean" };
		const result = checker.check(boolSub, boolSup, {
			data: true,
		}) as ResolvedSubsetResult;

		expect(result.isSubset).toBe(true);
	});

	test("boolean value NOT in enum → no narrowing, isSubset = false", () => {
		const boolSup: JSONSchema7 = { type: "boolean", enum: [true] };
		const boolSub: JSONSchema7 = { type: "boolean" };
		const result = checker.check(boolSub, boolSup, {
			data: false,
		}) as ResolvedSubsetResult;

		expect(result.isSubset).toBe(false);
	});

	test("value matches const in target → narrows sub, isSubset = true", () => {
		const constSup: JSONSchema7 = { type: "string", const: "fixed" };
		const sub: JSONSchema7 = { type: "string" };
		const result = checker.check(sub, constSup, {
			data: "fixed",
		}) as ResolvedSubsetResult;

		expect(result.isSubset).toBe(true);
	});

	test("value does NOT match const → no narrowing, isSubset = false", () => {
		const constSup: JSONSchema7 = { type: "string", const: "fixed" };
		const sub: JSONSchema7 = { type: "string" };
		const result = checker.check(sub, constSup, {
			data: "other",
		}) as ResolvedSubsetResult;

		expect(result.isSubset).toBe(false);
	});
});

describe("data narrowing — runtime validation", () => {
	test("string + enum with invalid runtime value → validates runtime data with AJV", () => {
		const schema: JSONSchema7 = {
			type: "string",
			enum: ["red", "green", "blue"],
		};

		const result = checker.check(schema, schema, {
			data: "yellow",
		}) as ResolvedSubsetResult;

		expect(result.isSubset).toBe(false);
		expect(result.resolvedSub.resolved).toEqual(schema);
	});

	test("string + format with invalid runtime value → validates runtime data with AJV", () => {
		const schema: JSONSchema7 = {
			type: "string",
			format: "email",
		};

		const result = checker.check(schema, schema, {
			data: "not-an-email",
		}) as ResolvedSubsetResult;

		expect(result.isSubset).toBe(false);
		expect(result.resolvedSub.resolved).toEqual(schema);
	});

	test("string + minLength with invalid runtime value → reports minLength runtime error", () => {
		const schema: JSONSchema7 = {
			type: "string",
			minLength: 5,
		};

		const result = checker.check(
			schema,
			{ type: "string" },
			{
				data: "a",
			},
		) as ResolvedSubsetResult;

		expect(result.isSubset).toBe(false);
		expect(result.errors).toEqual([
			{
				key: "$sub",
				expected: "minLength: 5",
				received: "a",
			},
		]);
		expect(result.resolvedSub.resolved).toEqual(schema);
	});

	test("string + enum with invalid runtime value → reports enum error at root", () => {
		const schema: JSONSchema7 = {
			type: "string",
			enum: ["red", "green", "blue"],
		};

		const result = checker.check(schema, schema, {
			data: "Je ne suis pas une couleur",
		}) as ResolvedSubsetResult;

		expect(result.isSubset).toBe(false);
		// Runtime validation runs against both resolved sub and sup.
		// Since both are the same schema, both produce an error.
		expect(result.errors).toEqual([
			{
				key: "$sub",
				expected: "red, green, or blue",
				received: "Je ne suis pas une couleur",
			},
			{
				key: "$sup",
				expected: "red, green, or blue",
				received: "Je ne suis pas une couleur",
			},
		]);
		expect(result.resolvedSub.resolved).toEqual(schema);
		expect(result.resolvedSup.resolved).toEqual(schema);
	});
});

// ── No Narrowing When Not Applicable ─────────────────────────────────────────

describe("data narrowing — no-op cases", () => {
	test("target has no enum or const → no narrowing", () => {
		const sub: JSONSchema7 = { type: "string" };
		const sup: JSONSchema7 = { type: "string", minLength: 1 };
		const result = checker.check(sub, sup, {
			data: "hello",
		}) as ResolvedSubsetResult;

		// string is not a subset of string+minLength regardless of data
		expect(result.resolvedSub.resolved).toEqual({ type: "string" });
	});

	test("sub already has enum → no narrowing applied", () => {
		const sub: JSONSchema7 = { type: "string", enum: ["a", "b"] };
		const sup: JSONSchema7 = {
			type: "string",
			enum: ["red", "green", "blue"],
		};
		const result = checker.check(sub, sup, {
			data: "red",
		}) as ResolvedSubsetResult;

		expect(result.isSubset).toBe(false);
		// Sub keeps its original enum, no narrowing
		expect(result.resolvedSub.resolved).toEqual({
			type: "string",
			enum: ["a", "b"],
		});
	});

	test("sub already has const → no narrowing applied", () => {
		const sub: JSONSchema7 = { type: "string", const: "hello" };
		const sup: JSONSchema7 = {
			type: "string",
			enum: ["red", "green", "blue"],
		};
		const result = checker.check(sub, sup, {
			data: "red",
		}) as ResolvedSubsetResult;

		expect(result.isSubset).toBe(false);
	});

	test("type mismatch — string vs number → no narrowing, isSubset = false", () => {
		const sub: JSONSchema7 = { type: "string" };
		const sup: JSONSchema7 = { type: "number" };
		const result = checker.check(sub, sup, {
			data: "hello",
		}) as ResolvedSubsetResult;

		expect(result.isSubset).toBe(false);
	});

	test("data is null → no narrowing", () => {
		const sub: JSONSchema7 = { type: "string" };
		const sup: JSONSchema7 = {
			type: "string",
			enum: ["red", "green", "blue"],
		};
		const result = checker.check(sub, sup, {
			data: null,
		}) as ResolvedSubsetResult;

		expect(result.isSubset).toBe(false);
		expect(result.resolvedSub.resolved).toEqual({ type: "string" });
	});

	test("data is undefined → no narrowing", () => {
		const sub: JSONSchema7 = { type: "string" };
		const sup: JSONSchema7 = {
			type: "string",
			enum: ["red", "green", "blue"],
		};

		// With data: undefined, the runtime path falls back to the static path.
		// The overload still returns ResolvedSubsetResult for type-safety,
		// but resolvedSub/resolvedSup reflect no-op resolution (branch: null).
		const staticResult = checker.check(sub, sup);
		const undefinedDataResult = checker.check(sub, sup, {
			data: undefined,
		});

		expect(undefinedDataResult.isSubset).toBe(false);
		expect(undefinedDataResult.isSubset).toBe(staticResult.isSubset);
		// resolvedSub/resolvedSup are present (overload contract) but reflect no resolution
		expect("resolvedSub" in undefinedDataResult).toBe(true);
		expect(undefinedDataResult.resolvedSub.branch).toBeNull();
		expect(undefinedDataResult.resolvedSup.branch).toBeNull();
		expect(undefinedDataResult.resolvedSub.resolved).toEqual(sub);
		expect(undefinedDataResult.resolvedSup.resolved).toEqual(sup);
	});
});

// ── Object Property Narrowing ────────────────────────────────────────────────

describe("data narrowing — object properties", () => {
	const sup: JSONSchema7 = {
		type: "object",
		properties: {
			color: { type: "string", enum: ["red", "green", "blue"] },
			size: { type: "number" },
		},
		required: ["color", "size"],
	};

	test("object with property value in enum → narrows that property, isSubset = true", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				color: { type: "string" },
				size: { type: "number" },
			},
			required: ["color", "size"],
		};
		const result = checker.check(sub, sup, {
			data: { color: "red", size: 42 },
		}) as ResolvedSubsetResult;

		expect(result.isSubset).toBe(true);
		expect(
			(result.resolvedSub.resolved.properties as Record<string, JSONSchema7>)
				.color,
		).toEqual({ type: "string", const: "red" });
	});

	test("object with property value NOT in enum → no narrowing, isSubset = false", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				color: { type: "string" },
				size: { type: "number" },
			},
			required: ["color", "size"],
		};
		const result = checker.check(sub, sup, {
			data: { color: "yellow", size: 42 },
		}) as ResolvedSubsetResult;

		expect(result.isSubset).toBe(false);
		expect(
			(result.resolvedSub.resolved.properties as Record<string, JSONSchema7>)
				.color,
		).toEqual({ type: "string" });
	});

	test("object with multiple enum properties — all match", () => {
		const multiEnumSup: JSONSchema7 = {
			type: "object",
			properties: {
				color: { type: "string", enum: ["red", "green", "blue"] },
				shape: { type: "string", enum: ["circle", "square"] },
			},
			required: ["color", "shape"],
		};
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				color: { type: "string" },
				shape: { type: "string" },
			},
			required: ["color", "shape"],
		};
		const result = checker.check(sub, multiEnumSup, {
			data: { color: "red", shape: "circle" },
		}) as ResolvedSubsetResult;

		expect(result.isSubset).toBe(true);
		const resolvedProps = result.resolvedSub.resolved.properties as Record<
			string,
			JSONSchema7
		>;
		expect(resolvedProps.color).toEqual({ type: "string", const: "red" });
		expect(resolvedProps.shape).toEqual({
			type: "string",
			const: "circle",
		});
	});

	test("object with multiple enum properties — partial match", () => {
		const multiEnumSup: JSONSchema7 = {
			type: "object",
			properties: {
				color: { type: "string", enum: ["red", "green", "blue"] },
				shape: { type: "string", enum: ["circle", "square"] },
			},
			required: ["color", "shape"],
		};
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				color: { type: "string" },
				shape: { type: "string" },
			},
			required: ["color", "shape"],
		};
		const result = checker.check(sub, multiEnumSup, {
			data: { color: "red", shape: "triangle" },
		}) as ResolvedSubsetResult;

		expect(result.isSubset).toBe(false);
		const resolvedProps = result.resolvedSub.resolved.properties as Record<
			string,
			JSONSchema7
		>;
		// color was narrowed because "red" is in the enum
		expect(resolvedProps.color).toEqual({ type: "string", const: "red" });
		// shape was NOT narrowed because "triangle" is not in the enum
		expect(resolvedProps.shape).toEqual({ type: "string" });
	});

	test("object data missing property key → no narrowing for that property", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				color: { type: "string" },
				size: { type: "number" },
			},
			required: ["color", "size"],
		};
		const result = checker.check(sub, sup, {
			data: { size: 42 },
		}) as ResolvedSubsetResult;

		expect(result.isSubset).toBe(false);
		expect(
			(result.resolvedSub.resolved.properties as Record<string, JSONSchema7>)
				.color,
		).toEqual({ type: "string" });
	});

	test("non-object data with object schema → no narrowing", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				color: { type: "string" },
			},
		};
		const result = checker.check(sub, sup, {
			data: "not-an-object",
		}) as ResolvedSubsetResult;

		expect(result.isSubset).toBe(false);
	});

	test("sub has no properties → no narrowing", () => {
		const sub: JSONSchema7 = { type: "object" };
		const result = checker.check(sub, sup, {
			data: { color: "red" },
		}) as ResolvedSubsetResult;

		expect(result.resolvedSub.resolved).toEqual({ type: "object" });
	});

	test("sup has no properties → no narrowing", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				color: { type: "string" },
			},
		};
		const supNoProps: JSONSchema7 = { type: "object" };
		const result = checker.check(sub, supNoProps, {
			data: { color: "red" },
		}) as ResolvedSubsetResult;

		expect(
			(result.resolvedSub.resolved.properties as Record<string, JSONSchema7>)
				.color,
		).toEqual({ type: "string" });
	});
});

// ── Nested Object Narrowing ──────────────────────────────────────────────────

describe("data narrowing — nested objects", () => {
	test("deeply nested property with enum → narrows recursively", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				config: {
					type: "object",
					properties: {
						mode: { type: "string" },
					},
					required: ["mode"],
				},
			},
			required: ["config"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				config: {
					type: "object",
					properties: {
						mode: { type: "string", enum: ["safe", "fast", "debug"] },
					},
					required: ["mode"],
				},
			},
			required: ["config"],
		};
		const result = checker.check(sub, sup, {
			data: { config: { mode: "safe" } },
		}) as ResolvedSubsetResult;

		expect(result.isSubset).toBe(true);
		const configSchema = (
			result.resolvedSub.resolved.properties as Record<string, JSONSchema7>
		).config;
		const configProps = configSchema?.properties as Record<string, JSONSchema7>;
		expect(configProps.mode).toEqual({ type: "string", const: "safe" });
	});

	test("deeply nested property value NOT in enum → no narrowing", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				config: {
					type: "object",
					properties: {
						mode: { type: "string" },
					},
					required: ["mode"],
				},
			},
			required: ["config"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				config: {
					type: "object",
					properties: {
						mode: { type: "string", enum: ["safe", "fast", "debug"] },
					},
					required: ["mode"],
				},
			},
			required: ["config"],
		};
		const result = checker.check(sub, sup, {
			data: { config: { mode: "unknown" } },
		}) as ResolvedSubsetResult;

		expect(result.isSubset).toBe(false);
	});
});

// ── Interaction With Condition Resolution ────────────────────────────────────

describe("data narrowing — combined with if/then/else", () => {
	test("condition resolution + enum narrowing together", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				kind: { type: "string" },
				value: { type: "string", minLength: 1 },
			},
			required: ["kind", "value"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				kind: { type: "string", enum: ["text", "data"] },
				value: { type: "string" },
			},
			required: ["kind", "value"],
			if: {
				properties: { kind: { const: "text" } },
			},
			then: {
				properties: { value: { minLength: 1 } },
			},
			else: {
				properties: { value: { maxLength: 100 } },
			},
		};
		const result = checker.check(sub, sup, {
			data: { kind: "text", value: "hello" },
		}) as ResolvedSubsetResult;

		// kind should be narrowed (text is in the sup enum)
		// value satisfies minLength:1 from resolved then-branch
		expect(result.isSubset).toBe(true);
		const resolvedSubProps = result.resolvedSub.resolved.properties as Record<
			string,
			JSONSchema7
		>;
		expect(resolvedSubProps.kind).toEqual({
			type: "string",
			const: "text",
		});
	});

	test("condition resolution + enum narrowing — sub value missing minLength → false", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				kind: { type: "string" },
				value: { type: "string" },
			},
			required: ["kind", "value"],
		};
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				kind: { type: "string", enum: ["text", "data"] },
				value: { type: "string" },
			},
			required: ["kind", "value"],
			if: {
				properties: { kind: { const: "text" } },
			},
			then: {
				properties: { value: { minLength: 1 } },
			},
			else: {
				properties: { value: { maxLength: 100 } },
			},
		};
		const result = checker.check(sub, sup, {
			data: { kind: "text", value: "hello" },
		}) as ResolvedSubsetResult;

		// kind gets narrowed, but value lacks minLength → not a subset
		expect(result.isSubset).toBe(false);
		const resolvedSubProps = result.resolvedSub.resolved.properties as Record<
			string,
			JSONSchema7
		>;
		// kind still gets narrowed even though overall result is false
		expect(resolvedSubProps.kind).toEqual({
			type: "string",
			const: "text",
		});
	});
});

// ── data narrowing ────────────────────────────────────────────────────────

describe("data narrowing — data", () => {
	test("data narrows the sup schema when sub has enum", () => {
		const sub: JSONSchema7 = {
			type: "string",
			enum: ["red", "green", "blue"],
		};
		const sup: JSONSchema7 = { type: "string" };
		const result = checker.check(sub, sup, {
			data: "red",
		}) as ResolvedSubsetResult;

		// With a single `data`, the same value is used for both sub and sup.
		// The sup is narrowed via runtime data even though it has no enum,
		// while sub already has enum — the check still succeeds.
		expect(result.isSubset).toBe(true);
	});

	test("data narrows sup with enum when sub is generic", () => {
		const sub: JSONSchema7 = { type: "string" };
		const sup: JSONSchema7 = {
			type: "string",
			enum: ["red", "green", "blue"],
		};
		const result = checker.check(sub, sup, {
			data: "red",
		}) as ResolvedSubsetResult;

		// data is used for both sub and sup — sup is narrowed to const:"red"
		expect(result.isSubset).toBe(true);
		expect(result.resolvedSup.resolved).toEqual({
			type: "string",
			enum: ["red", "green", "blue"],
			const: "red",
		});
	});
});
