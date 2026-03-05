import { beforeAll, describe, expect, test } from "bun:test";
import type { JSONSchema7 } from "json-schema";
import { JsonSchemaCompatibilityChecker } from "../../src";

let checker: JsonSchemaCompatibilityChecker;

beforeAll(() => {
	checker = new JsonSchemaCompatibilityChecker();
});

// ═══════════════════════════════════════════════════════════════════════════════
//  Boolean schema (`false`) in properties — vacuous truth
//
//  In JSON Schema Draft-07, `properties: { x: false }` means "if x is present,
//  it must validate against `false` (impossible)". If x is **absent** from the
//  instance, the constraint is **trivially satisfied** (vacuous truth).
//
//  A sub schema that does not define a property is always a valid subset of a
//  sup schema that forbids that property via `false`.
// ═══════════════════════════════════════════════════════════════════════════════

// ── Subset: absent property vs forbidden property ────────────────────────────

describe("false-schema properties — vacuous truth (absent ⊆ forbidden)", () => {
	test("absent property in sub ⊆ false property in sup", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: { name: { type: "string" } },
			required: ["name"],
			additionalProperties: false,
		};

		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				name: { type: "string" },
				deleted: false,
			},
			required: ["name"],
		};

		expect(checker.isSubset(sub, sup)).toBe(true);
	});

	test("multiple absent properties in sub ⊆ multiple false properties in sup", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: { id: { type: "number" } },
			required: ["id"],
			additionalProperties: false,
		};

		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				id: { type: "number" },
				foo: false,
				bar: false,
				baz: false,
			},
			required: ["id"],
		};

		expect(checker.isSubset(sub, sup)).toBe(true);
	});

	test("sub has some properties, sup has extra false properties → isSubset: true", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				name: { type: "string" },
				age: { type: "number" },
			},
			required: ["name", "age"],
			additionalProperties: false,
		};

		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				name: { type: "string" },
				age: { type: "number" },
				secret: false,
			},
			required: ["name"],
		};

		expect(checker.isSubset(sub, sup)).toBe(true);
	});

	test("check() returns isSubset: true with empty errors for vacuous false property", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: { status: { type: "string" } },
			required: ["status"],
			additionalProperties: false,
		};

		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				status: { type: "string" },
				internal: false,
			},
			required: ["status"],
		};

		const result = checker.check(sub, sup);
		expect(result.isSubset).toBe(true);
		expect(result.errors).toHaveLength(0);
	});
});

// ── Subset: present property vs forbidden property ───────────────────────────

describe("false-schema properties — present property ⊄ forbidden property", () => {
	test("sub defines a property that sup marks as false → isSubset: false", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				name: { type: "string" },
				secret: { type: "string" },
			},
			required: ["name"],
		};

		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				name: { type: "string" },
				secret: false,
			},
			required: ["name"],
		};

		expect(checker.isSubset(sub, sup)).toBe(false);
	});

	test("sub has required property that sup forbids → isSubset: false", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				id: { type: "number" },
				token: { type: "string" },
			},
			required: ["id", "token"],
		};

		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				id: { type: "number" },
				token: false,
			},
			required: ["id"],
		};

		expect(checker.isSubset(sub, sup)).toBe(false);
	});
});

// ── With condition resolution (if/then/else) ─────────────────────────────────

describe("false-schema properties — with if/then condition resolution", () => {
	test("resolved then adds property: false, absent from sub → isSubset: true", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: { withAI: { type: "boolean" } },
			required: ["withAI"],
			additionalProperties: false,
		};

		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				withAI: { type: "boolean" },
				title: { type: "string" },
			},
			required: ["withAI"],
			if: {
				properties: { withAI: { const: true } },
				required: ["withAI"],
			},
			then: { properties: { title: false } },
		};

		const result = checker.check(sub, sup, { subData: { withAI: true } });
		expect(result.isSubset).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	test("resolved then adds property: false, present in sub → isSubset: false", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				withAI: { type: "boolean" },
				title: { type: "string" },
			},
			required: ["withAI", "title"],
		};

		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				withAI: { type: "boolean" },
				title: { type: "string" },
			},
			required: ["withAI"],
			if: {
				properties: { withAI: { const: true } },
				required: ["withAI"],
			},
			then: { properties: { title: false } },
		};

		const result = checker.check(sub, sup, { subData: { withAI: true } });
		expect(result.isSubset).toBe(false);
	});

	test("condition not triggered — property stays normal → isSubset: true", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				withAI: { type: "boolean" },
				title: { type: "string" },
			},
			required: ["withAI", "title"],
		};

		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				withAI: { type: "boolean" },
				title: { type: "string" },
			},
			required: ["withAI"],
			if: {
				properties: { withAI: { const: true } },
				required: ["withAI"],
			},
			then: { properties: { title: false } },
		};

		// withAI: false → condition not triggered → title stays { type: "string" }
		const result = checker.check(sub, sup, { subData: { withAI: false } });
		expect(result.isSubset).toBe(true);
		expect(result.errors).toHaveLength(0);
	});
});

// ── Sanity checks — no false schemas involved ────────────────────────────────

describe("false-schema properties — sanity checks (no false schemas)", () => {
	test("matching properties without false → isSubset: true", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				withAI: { type: "boolean" },
				title: { type: "string" },
			},
			required: ["withAI", "title"],
		};

		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				withAI: { type: "boolean" },
				title: { type: "string" },
			},
			required: ["withAI"],
		};

		const result = checker.check(sub, sup);
		expect(result.isSubset).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	test("identity A ⊆ A with false property → isSubset: true", () => {
		const schema: JSONSchema7 = {
			type: "object",
			properties: {
				name: { type: "string" },
				forbidden: false,
			},
			required: ["name"],
		};

		expect(checker.isSubset(schema, schema)).toBe(true);
	});
});
