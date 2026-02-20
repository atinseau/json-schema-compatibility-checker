import { beforeAll, describe, expect, test } from "bun:test";
import type { JSONSchema7 } from "json-schema";
import { JsonSchemaCompatibilityChecker } from "../../src";

let checker: JsonSchemaCompatibilityChecker;

beforeAll(() => {
	checker = new JsonSchemaCompatibilityChecker();
});

// ═══════════════════════════════════════════════════════════════════════════════
//  resolveConditions — branch resolution, allOf with conditions
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
//  resolveConditions
// ─────────────────────────────────────────────────────────────────────────────

describe("resolveConditions", () => {
	const formSchema: JSONSchema7 = {
		type: "object",
		properties: {
			accountType: { type: "string", enum: ["personal", "business"] },
			email: { type: "string", format: "email" },
			companyName: { type: "string" },
			taxId: { type: "string" },
			firstName: { type: "string" },
			lastName: { type: "string" },
		},
		required: ["accountType", "email"],
		if: {
			properties: { accountType: { const: "business" } },
			required: ["accountType"],
		},
		then: {
			required: ["companyName", "taxId"],
		},
		else: {
			required: ["firstName", "lastName"],
		},
	};

	// ── Branch selection ─────────────────────────────────────────────────────

	test("resolves then-branch when data matches if-condition", () => {
		const { resolved, branch } = checker.resolveConditions(formSchema, {
			accountType: "business",
		});

		expect(branch).toBe("then");
		expect(resolved.if).toBeUndefined();
		expect(resolved.then).toBeUndefined();
		expect(resolved.else).toBeUndefined();
		expect(resolved.required).toContain("companyName");
		expect(resolved.required).toContain("taxId");
	});

	test("resolves else-branch when data does not match if-condition", () => {
		const { resolved, branch } = checker.resolveConditions(formSchema, {
			accountType: "personal",
		});

		expect(branch).toBe("else");
		expect(resolved.if).toBeUndefined();
		expect(resolved.required).toContain("firstName");
		expect(resolved.required).toContain("lastName");
		expect(resolved.required).not.toContain("companyName");
	});

	test("resolves else-branch when discriminant is missing from data", () => {
		const { resolved, branch } = checker.resolveConditions(formSchema, {});

		expect(branch).toBe("else");
		expect(resolved.required).toContain("firstName");
	});

	// ── Discriminant tracking ────────────────────────────────────────────────

	test("reports discriminant values used for resolution", () => {
		const { discriminant } = checker.resolveConditions(formSchema, {
			accountType: "business",
		});

		expect(discriminant).toEqual({ accountType: "business" });
	});

	test("discriminant is empty when data lacks discriminant fields", () => {
		const { discriminant } = checker.resolveConditions(formSchema, {});
		expect(discriminant).toEqual({});
	});

	// ── Removal of if/then/else ──────────────────────────────────────────────

	test("resolved schema has no if/then/else keywords", () => {
		const { resolved } = checker.resolveConditions(formSchema, {
			accountType: "business",
		});

		expect("if" in resolved).toBe(false);
		expect("then" in resolved).toBe(false);
		expect("else" in resolved).toBe(false);
	});

	// ── Base required preserved ──────────────────────────────────────────────

	test("base required fields are preserved alongside branch required", () => {
		const { resolved } = checker.resolveConditions(formSchema, {
			accountType: "business",
		});

		// Base required
		expect(resolved.required).toContain("accountType");
		expect(resolved.required).toContain("email");
		// Branch required
		expect(resolved.required).toContain("companyName");
		expect(resolved.required).toContain("taxId");
	});

	test("no duplicate required entries", () => {
		const schema: JSONSchema7 = {
			type: "object",
			properties: { x: { type: "string" } },
			required: ["x"],
			if: { properties: { x: { const: "a" } } },
			then: { required: ["x"] },
		};

		const { resolved } = checker.resolveConditions(schema, { x: "a" });
		const xCount = resolved.required?.filter((r) => r === "x").length;
		expect(xCount).toBe(1);
	});

	// ── Property merging from branch ─────────────────────────────────────────

	test("properties from then-branch are merged into resolved schema", () => {
		const schema: JSONSchema7 = {
			type: "object",
			properties: {
				mode: { type: "string" },
				value: { type: "string" },
			},
			required: ["mode", "value"],
			if: { properties: { mode: { const: "strict" } }, required: ["mode"] },
			then: {
				properties: { value: { type: "string", minLength: 1 } },
			},
		};

		const { resolved } = checker.resolveConditions(schema, { mode: "strict" });
		const valueProp = resolved.properties?.value as JSONSchema7;

		expect(valueProp.type).toBe("string");
		expect(valueProp.minLength).toBe(1);
	});

	test("properties from else-branch are merged when condition mismatches", () => {
		const schema: JSONSchema7 = {
			type: "object",
			properties: {
				mode: { type: "string" },
				output: {},
			},
			required: ["mode"],
			if: { properties: { mode: { const: "json" } }, required: ["mode"] },
			then: { properties: { output: { type: "object" } } },
			else: { properties: { output: { type: "string" } } },
		};

		const { resolved } = checker.resolveConditions(schema, { mode: "text" });
		const outputProp = resolved.properties?.output as JSONSchema7;

		expect(outputProp.type).toBe("string");
	});

	// ── Schema without conditions ────────────────────────────────────────────

	test("schema without if/then/else passes through unchanged", () => {
		const schema: JSONSchema7 = {
			type: "object",
			properties: { name: { type: "string" } },
			required: ["name"],
		};

		const { resolved, branch } = checker.resolveConditions(schema, {});

		expect(branch).toBeNull();
		expect(resolved.type).toBe("object");
		expect(resolved.required).toEqual(["name"]);
	});

	// ── if/then without else ─────────────────────────────────────────────────

	test("if/then without else: then-branch applied when matching", () => {
		const schema: JSONSchema7 = {
			type: "object",
			properties: {
				status: { type: "string" },
				activatedAt: { type: "string", format: "date-time" },
			},
			required: ["status"],
			if: { properties: { status: { const: "active" } }, required: ["status"] },
			then: { required: ["activatedAt"] },
		};

		const { resolved, branch } = checker.resolveConditions(schema, {
			status: "active",
		});

		expect(branch).toBe("then");
		expect(resolved.required).toContain("activatedAt");
	});

	test("if/then without else: no additional constraints when not matching", () => {
		const schema: JSONSchema7 = {
			type: "object",
			properties: {
				status: { type: "string" },
				activatedAt: { type: "string", format: "date-time" },
			},
			required: ["status"],
			if: { properties: { status: { const: "active" } }, required: ["status"] },
			then: { required: ["activatedAt"] },
		};

		const { resolved, branch } = checker.resolveConditions(schema, {
			status: "inactive",
		});

		expect(branch).toBe("else");
		expect(resolved.required).not.toContain("activatedAt");
		expect(resolved.required).toContain("status");
	});

	// ── Enum-based condition ─────────────────────────────────────────────────

	test("if-condition with enum check resolves correctly", () => {
		const schema: JSONSchema7 = {
			type: "object",
			properties: {
				tier: { type: "string" },
				limit: { type: "number" },
			},
			required: ["tier"],
			if: {
				properties: { tier: { enum: ["premium", "enterprise"] } },
				required: ["tier"],
			},
			then: {
				properties: { limit: { type: "number", minimum: 1000 } },
				required: ["limit"],
			},
			else: {
				properties: { limit: { type: "number", maximum: 100 } },
			},
		};

		const premium = checker.resolveConditions(schema, { tier: "premium" });
		expect(premium.branch).toBe("then");
		expect(premium.resolved.required).toContain("limit");

		const free = checker.resolveConditions(schema, { tier: "free" });
		expect(free.branch).toBe("else");
		expect(free.resolved.required).not.toContain("limit");
	});

	// ── Nested conditions (if/then/else inside a property) ───────────────────

	test("resolves nested conditions in properties recursively", () => {
		const schema: JSONSchema7 = {
			type: "object",
			properties: {
				config: {
					type: "object",
					properties: {
						mode: { type: "string", enum: ["fast", "safe"] },
						retries: { type: "integer" },
						timeout: { type: "integer" },
					},
					required: ["mode"],
					if: { properties: { mode: { const: "safe" } }, required: ["mode"] },
					then: {
						required: ["retries", "timeout"],
						properties: {
							retries: { type: "integer", minimum: 3 },
							timeout: { type: "integer", minimum: 5000 },
						},
					},
				},
			},
			required: ["config"],
		};

		const { resolved, discriminant } = checker.resolveConditions(schema, {
			config: { mode: "safe" },
		});

		const configProp = resolved.properties?.config as JSONSchema7;
		expect(configProp.required).toContain("retries");
		expect(configProp.required).toContain("timeout");
		expect(configProp.if).toBeUndefined();
		// The discriminant key is the dot-joined string "config.mode", not a nested path
		expect(discriminant["config.mode"]).toBe("safe");
	});

	test("nested condition resolves else when nested data mismatches", () => {
		const schema: JSONSchema7 = {
			type: "object",
			properties: {
				config: {
					type: "object",
					properties: {
						mode: { type: "string" },
						retries: { type: "integer" },
					},
					required: ["mode"],
					if: { properties: { mode: { const: "safe" } }, required: ["mode"] },
					then: { required: ["retries"] },
				},
			},
			required: ["config"],
		};

		const { resolved } = checker.resolveConditions(schema, {
			config: { mode: "fast" },
		});

		const configProp = resolved.properties?.config as JSONSchema7;
		expect(configProp.required).not.toContain("retries");
		expect(configProp.required).toContain("mode");
	});

	test("nested condition with no matching data resolves to else", () => {
		const schema: JSONSchema7 = {
			type: "object",
			properties: {
				child: {
					type: "object",
					properties: { x: { type: "string" } },
					if: { properties: { x: { const: "a" } } },
					then: { required: ["x"] },
				},
			},
		};

		// No data for "child" property — should resolve via empty object → else
		const { resolved } = checker.resolveConditions(schema, {});
		const childProp = resolved.properties?.child as JSONSchema7;
		expect(childProp.if).toBeUndefined();
	});
});

// ─────────────────────────────────────────────────────────────────────────────
//  resolveConditions — allOf with if/then/else
// ─────────────────────────────────────────────────────────────────────────────

describe("resolveConditions with allOf containing if/then/else", () => {
	const schemaWithAllOfConditions: JSONSchema7 = {
		type: "object",
		properties: {
			name: { type: "string" },
			age: { type: "number" },
			role: { type: "string", enum: ["admin", "user", "guest"] },
		},
		required: ["name"],
		allOf: [
			{
				if: {
					properties: {
						age: { type: "number", exclusiveMinimum: 20 },
					},
					required: ["age"],
				},
				then: {
					required: ["email"],
					properties: {
						email: { type: "string" },
					},
				},
			},
			{
				if: {
					properties: {
						role: { const: "admin" },
					},
					required: ["role"],
				},
				then: {
					properties: {
						permissions: { type: "array", items: { type: "string" } },
					},
					required: ["permissions"],
				},
			},
		],
	};

	test("no allOf condition matches when discriminant fields are missing", () => {
		const { resolved, branch } = checker.resolveConditions(
			schemaWithAllOfConditions,
			{ name: "Alice" },
		);

		// No top-level if/then/else → branch is null
		expect(branch).toBe(null);

		// allOf should be removed (all entries were conditional-only)
		expect(resolved.allOf).toBeUndefined();

		// No if/then/else remnants
		expect(resolved.if).toBeUndefined();
		expect(resolved.then).toBeUndefined();
		expect(resolved.else).toBeUndefined();

		// Base properties preserved
		expect(resolved.properties).toBeDefined();
		expect(resolved.properties?.name).toEqual({ type: "string" });
		expect(resolved.properties?.age).toEqual({ type: "number" });
		expect(resolved.properties?.role).toEqual({
			type: "string",
			enum: ["admin", "user", "guest"],
		});

		// No extra properties from then branches
		expect(resolved.properties?.email).toBeUndefined();
		expect(resolved.properties?.permissions).toBeUndefined();

		// Required unchanged
		expect(resolved.required).toEqual(["name"]);
	});

	test("first allOf condition matches, second does not", () => {
		const { resolved } = checker.resolveConditions(schemaWithAllOfConditions, {
			name: "Alice",
			age: 25,
		});

		expect(resolved.allOf).toBeUndefined();

		// email added from first then-branch
		expect(resolved.properties?.email).toEqual({ type: "string" });
		expect(resolved.required).toContain("email");

		// permissions NOT added (role missing)
		expect(resolved.properties?.permissions).toBeUndefined();
		expect(resolved.required).not.toContain("permissions");

		// Base required preserved
		expect(resolved.required).toContain("name");
	});

	test("second allOf condition matches, first does not", () => {
		const { resolved } = checker.resolveConditions(schemaWithAllOfConditions, {
			name: "Alice",
			role: "admin",
		});

		expect(resolved.allOf).toBeUndefined();

		// permissions added from second then-branch
		expect(resolved.properties?.permissions).toEqual({
			type: "array",
			items: { type: "string" },
		});
		expect(resolved.required).toContain("permissions");

		// email NOT added (age missing)
		expect(resolved.properties?.email).toBeUndefined();
		expect(resolved.required).not.toContain("email");
	});

	test("both allOf conditions match", () => {
		const { resolved } = checker.resolveConditions(schemaWithAllOfConditions, {
			name: "Alice",
			age: 25,
			role: "admin",
		});

		expect(resolved.allOf).toBeUndefined();

		// Both then-branches applied
		expect(resolved.properties?.email).toEqual({ type: "string" });
		expect(resolved.properties?.permissions).toEqual({
			type: "array",
			items: { type: "string" },
		});
		expect(resolved.required).toContain("name");
		expect(resolved.required).toContain("email");
		expect(resolved.required).toContain("permissions");
	});

	test("allOf conditions collect discriminants (const/enum and numeric constraints)", () => {
		// Point 5: extractDiscriminants now also collects values for properties
		// with numeric constraints (exclusiveMinimum, minimum, maximum, etc.).
		// age uses type + exclusiveMinimum → now collected.
		// role uses const → collected.
		const { discriminant } = checker.resolveConditions(
			schemaWithAllOfConditions,
			{ name: "Alice", age: 25, role: "admin" },
		);

		expect(discriminant.age).toBe(25);
		expect(discriminant.role).toBe("admin");
	});

	test("allOf with else branches resolves correctly", () => {
		const schemaWithElse: JSONSchema7 = {
			type: "object",
			properties: {
				mode: { type: "string" },
			},
			required: ["mode"],
			allOf: [
				{
					if: {
						properties: { mode: { const: "advanced" } },
						required: ["mode"],
					},
					then: {
						properties: { debug: { type: "boolean" } },
						required: ["debug"],
					},
					else: {
						properties: { simple: { type: "boolean" } },
						required: ["simple"],
					},
				},
			],
		};

		// Match → then branch
		const thenResult = checker.resolveConditions(schemaWithElse, {
			mode: "advanced",
		});
		expect(thenResult.resolved.properties?.debug).toEqual({ type: "boolean" });
		expect(thenResult.resolved.required).toContain("debug");
		expect(thenResult.resolved.properties?.simple).toBeUndefined();

		// No match → else branch
		const elseResult = checker.resolveConditions(schemaWithElse, {
			mode: "basic",
		});
		expect(elseResult.resolved.properties?.simple).toEqual({
			type: "boolean",
		});
		expect(elseResult.resolved.required).toContain("simple");
		expect(elseResult.resolved.properties?.debug).toBeUndefined();
	});

	test("allOf with non-conditional entries preserves them", () => {
		const schema: JSONSchema7 = {
			type: "object",
			properties: {
				name: { type: "string" },
			},
			allOf: [
				{ required: ["name"] },
				{
					if: {
						properties: { name: { const: "admin" } },
						required: ["name"],
					},
					then: {
						properties: { secret: { type: "string" } },
					},
				},
			],
		};

		const { resolved } = checker.resolveConditions(schema, { name: "admin" });

		// Non-conditional allOf entry should be preserved
		expect(resolved.allOf).toBeDefined();
		expect(resolved.allOf).toHaveLength(1);
		expect(resolved.allOf?.[0]).toEqual({ required: ["name"] });

		// Conditional entry resolved: secret property added
		expect(resolved.properties?.secret).toEqual({ type: "string" });
	});

	test("allOf resolved schema has no if/then/else keywords", () => {
		const { resolved } = checker.resolveConditions(schemaWithAllOfConditions, {
			name: "Alice",
			age: 25,
		});

		expect(resolved.if).toBeUndefined();
		expect(resolved.then).toBeUndefined();
		expect(resolved.else).toBeUndefined();
		expect(resolved.allOf).toBeUndefined();
	});

	test("allOf combined with top-level if/then/else resolves both", () => {
		const schema: JSONSchema7 = {
			type: "object",
			properties: {
				kind: { type: "string" },
				value: {},
			},
			required: ["kind"],
			if: {
				properties: { kind: { const: "number" } },
				required: ["kind"],
			},
			then: {
				properties: { value: { type: "number" } },
			},
			else: {
				properties: { value: { type: "string" } },
			},
			allOf: [
				{
					if: {
						properties: { kind: { const: "number" } },
						required: ["kind"],
					},
					then: {
						properties: { precision: { type: "integer" } },
					},
				},
			],
		};

		const { resolved, branch } = checker.resolveConditions(schema, {
			kind: "number",
		});

		// Top-level if/then/else resolved
		expect(branch).toBe("then");
		expect(resolved.if).toBeUndefined();

		// allOf condition also resolved
		expect(resolved.allOf).toBeUndefined();
		expect(resolved.properties?.precision).toEqual({ type: "integer" });
	});
});
