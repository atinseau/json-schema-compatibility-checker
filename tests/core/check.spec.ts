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
	test("returns isSubset: true and empty diffs when compatible", () => {
		const result = checker.check(
			{ type: "string", minLength: 5 },
			{ type: "string" },
		);
		expect(result.isSubset).toBe(true);
		expect(result.diffs).toEqual([]);
		expect(result.merged).not.toBeNull();
	});

	test("returns isSubset: false and meaningful diffs for missing required", () => {
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
		expect(result.diffs.length).toBeGreaterThan(0);

		const requiredDiff = result.diffs.find((d) => d.path === "required");
		expect(requiredDiff).toBeDefined();
		expect(requiredDiff?.type).toBe("changed");

		const ageDiff = result.diffs.find((d) => d.path === "properties.age");
		expect(ageDiff).toBeDefined();
		expect(ageDiff?.type).toBe("added");
	});

	test("returns incompatible error for conflicting types", () => {
		const result = checker.check({ type: "string" }, { type: "number" });

		expect(result.isSubset).toBe(false);
		expect(result.merged).toBeNull();
		expect(result.diffs.length).toBe(1);
		expect(result.diffs[0]?.path).toBe("$");
		expect(String(result.diffs[0]?.actual)).toContain("Incompatible");
	});

	test("diff path traces through nested objects", () => {
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

		const bioDiff = result.diffs.find(
			(d) => d.path === "properties.user.properties.profile.properties.bio",
		);
		expect(bioDiff).toBeDefined();
		expect(bioDiff?.type).toBe("added");

		const reqDiff = result.diffs.find(
			(d) => d.path === "properties.user.properties.profile.required",
		);
		expect(reqDiff).toBeDefined();
	});

	test("diff reports additionalProperties constraint", () => {
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

		const addPropDiff = result.diffs.find(
			(d) => d.path === "additionalProperties",
		);
		expect(addPropDiff).toBeDefined();
	});

	test("diff reports numeric constraint changes", () => {
		const result = checker.check(
			{ type: "number", minimum: 0, maximum: 100 },
			{ type: "number", minimum: 5, maximum: 10 },
		);

		expect(result.isSubset).toBe(false);
		expect(result.diffs.find((d) => d.path === "minimum")).toBeDefined();
		expect(result.diffs.find((d) => d.path === "maximum")).toBeDefined();
	});

	test("diffs for anyOf branch rejection", () => {
		const sub: JSONSchema7 = {
			anyOf: [{ type: "string" }, { type: "number" }, { type: "boolean" }],
		};
		const sup: JSONSchema7 = {
			anyOf: [{ type: "string" }, { type: "number" }],
		};
		const result = checker.check(sub, sup);

		expect(result.isSubset).toBe(false);
		const branchDiff = result.diffs.find((d) => d.path === "anyOf[2]");
		expect(branchDiff).toBeDefined();
		expect(String(branchDiff?.actual)).toContain("Branch not accepted");
	});

	test("diffs for anyOf superset with no matching branch", () => {
		const result = checker.check(
			{ type: "boolean" },
			{ anyOf: [{ type: "string" }, { type: "number" }] },
		);

		expect(result.isSubset).toBe(false);
		expect(result.diffs.length).toBe(1);
		expect(String(result.diffs[0]?.actual)).toContain("No branch");
	});

	test("enum diff shows changed values", () => {
		const result = checker.check(
			{ type: "string", enum: ["a", "b", "c", "d"] },
			{ type: "string", enum: ["a", "b"] },
		);
		expect(result.isSubset).toBe(false);

		const enumDiff = result.diffs.find((d) => d.path === "enum");
		expect(enumDiff).toBeDefined();
		expect(enumDiff?.type).toBe("changed");
	});

	test("pattern added shows as diff", () => {
		const result = checker.check(
			{ type: "string", minLength: 1 },
			{ type: "string", minLength: 1, pattern: "^[a-z]+$" },
		);
		expect(result.isSubset).toBe(false);

		const patternDiff = result.diffs.find((d) => d.path === "pattern");
		expect(patternDiff).toBeDefined();
		expect(patternDiff?.type).toBe("added");
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
		expect(formatted).not.toContain("Diffs");
	});

	test("formats a failing result with ❌ icon and diffs", () => {
		const result = checker.check(
			{ type: "number", minimum: 0, maximum: 100 },
			{ type: "number", minimum: 5, maximum: 10 },
		);
		const formatted = checker.formatResult("range check", result);

		expect(formatted).toContain("❌");
		expect(formatted).toContain("range check");
		expect(formatted).toContain("false");
		expect(formatted).toContain("Diffs");
		expect(formatted).toContain("minimum");
		expect(formatted).toContain("maximum");
	});

	test("formats added diffs with + prefix", () => {
		const result = checker.check(
			{ type: "string" },
			{ type: "string", pattern: "^[a-z]+$" },
		);
		const formatted = checker.formatResult("label", result);

		expect(formatted).toContain("+ pattern");
	});

	test("formats removed diffs with - prefix", () => {
		const result = checker.check(
			{
				type: "object",
				properties: {
					name: { type: "string" },
					age: { type: "number" },
				},
				required: ["name"],
			},
			{
				type: "object",
				properties: { name: { type: "string" } },
				required: ["name"],
				additionalProperties: false,
			},
		);
		const formatted = checker.formatResult("label", result);

		expect(formatted).toContain("- properties.age");
	});

	test("formats changed diffs with ~ prefix and arrow", () => {
		const result = checker.check(
			{ type: "number", minimum: 0 },
			{ type: "number", minimum: 5 },
		);
		const formatted = checker.formatResult("label", result);

		expect(formatted).toContain("~ minimum");
		expect(formatted).toContain("→");
	});

	test("formats incompatible type error", () => {
		const result = checker.check({ type: "string" }, { type: "number" });
		const formatted = checker.formatResult("type clash", result);

		expect(formatted).toContain("❌");
		expect(formatted).toContain("Incompatible");
	});
});
