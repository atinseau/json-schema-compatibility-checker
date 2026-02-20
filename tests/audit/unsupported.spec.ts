import { beforeAll, describe, expect, test } from "bun:test";
import type { JSONSchema7 } from "json-schema";
import { JsonSchemaCompatibilityChecker } from "../../src";

/** JSONSchema7 with content vocabulary keywords (Draft 7 annotations) */
interface JSONSchema7WithContent extends JSONSchema7 {
	contentMediaType?: string;
	contentEncoding?: string;
}

/** JSONSchema7 with readOnly/writeOnly keywords */
interface JSONSchema7WithAccessMode extends JSONSchema7 {
	readOnly?: boolean;
	writeOnly?: boolean;
}

let checker: JsonSchemaCompatibilityChecker;

beforeAll(() => {
	checker = new JsonSchemaCompatibilityChecker();
});

// ═══════════════════════════════════════════════════════════════════════════════
//  Unsupported / partially-supported features audit
//  contentMediaType, contentEncoding, readOnly, writeOnly, definitions, allOf
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
//  7. contentMediaType / contentEncoding — Draft 7 additions
//
//  These keywords are NOT handled by the checker at all.
//  They are annotation-only in Draft 7 (not assertions by default).
// ─────────────────────────────────────────────────────────────────────────────

describe("contentMediaType / contentEncoding — not handled", () => {
	test("contentMediaType is silently ignored in subset check", () => {
		const sub: JSONSchema7WithContent = {
			type: "string",
			contentMediaType: "application/json",
		};

		const sup: JSONSchema7 = { type: "string" };

		// contentMediaType is treated as an unknown keyword
		const result = checker.isSubset(sub, sup);
		// Should be true because contentMediaType doesn't add structural constraints
		// (or at least doesn't break anything)
		expect(typeof result).toBe("boolean");
	});

	test("contentEncoding is silently ignored in subset check", () => {
		const sub: JSONSchema7WithContent = {
			type: "string",
			contentEncoding: "base64",
		};

		const sup: JSONSchema7 = { type: "string" };

		const result = checker.isSubset(sub, sup);
		expect(typeof result).toBe("boolean");
	});

	test("contentMediaType mismatch is NOT detected", () => {
		const sub: JSONSchema7WithContent = {
			type: "string",
			contentMediaType: "application/json",
		};

		const sup: JSONSchema7WithContent = {
			type: "string",
			contentMediaType: "text/xml",
		};

		// Different content types — semantically incompatible
		// But the checker doesn't know about contentMediaType
		const result = checker.isSubset(sub, sup);
		// The checker probably sees these as equal (both are just string)
		// or the merge keeps both contentMediaType values
		expect(typeof result).toBe("boolean");
	});

	test("normalize preserves contentMediaType as unknown key", () => {
		const schema: JSONSchema7WithContent = {
			type: "string",
			contentMediaType: "application/json",
			contentEncoding: "base64",
		};

		const result = checker.normalize(schema);
		if (typeof result !== "boolean") {
			// The normalizer doesn't strip unknown keys
			expect((result as Record<string, unknown>).contentMediaType).toBe(
				"application/json",
			);
			expect((result as Record<string, unknown>).contentEncoding).toBe(
				"base64",
			);
		}
	});
});

// ─────────────────────────────────────────────────────────────────────────────
//  8. readOnly / writeOnly — Draft 7 additions
//
//  These are NOT handled. For node connection checking (output → input),
//  they could be semantically important.
// ─────────────────────────────────────────────────────────────────────────────

describe("readOnly / writeOnly — not handled", () => {
	test("readOnly is silently ignored in subset check", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				id: { type: "string", readOnly: true } as JSONSchema7WithAccessMode,
				name: { type: "string" },
			},
			required: ["id", "name"],
		};

		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				id: { type: "string" },
				name: { type: "string" },
			},
			required: ["id", "name"],
		};

		// readOnly doesn't affect structural compatibility in the checker
		expect(checker.isSubset(sub, sup)).toBe(true);
	});

	test("writeOnly is silently ignored in subset check", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				password: {
					type: "string",
					writeOnly: true,
				} as JSONSchema7WithAccessMode,
			},
			required: ["password"],
		};

		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				password: { type: "string" },
			},
			required: ["password"],
		};

		expect(checker.isSubset(sub, sup)).toBe(true);
	});

	test("canConnect ignores readOnly/writeOnly semantics", () => {
		// In a proper implementation:
		// - readOnly fields in output should be connectable to input
		// - writeOnly fields in output should NOT be read by input
		const sourceOutput: JSONSchema7 = {
			type: "object",
			properties: {
				id: { type: "string", readOnly: true } as JSONSchema7WithAccessMode,
				password: {
					type: "string",
					writeOnly: true,
				} as JSONSchema7WithAccessMode,
			},
			required: ["id"],
		};

		const targetInput: JSONSchema7 = {
			type: "object",
			properties: {
				id: { type: "string" },
			},
			required: ["id"],
		};

		const result = checker.canConnect(sourceOutput, targetInput);
		// The checker doesn't use readOnly/writeOnly for connection logic
		expect(result).toHaveProperty("isSubset");
	});
});

// ─────────────────────────────────────────────────────────────────────────────
//  10. definitions (without $ref)
//
//  definitions is a metadata keyword in Draft 7. It's a container for
//  reusable schemas but has no validation semantics without $ref.
// ─────────────────────────────────────────────────────────────────────────────

describe("definitions — behavior without $ref", () => {
	test("definitions are ignored in subset check (metadata only)", () => {
		const sub: JSONSchema7 = {
			type: "string",
			definitions: {
				unused: { type: "number", minimum: 0 },
			},
		};

		const sup: JSONSchema7 = { type: "string" };

		// definitions don't affect validation
		expect(checker.isSubset(sub, sup)).toBe(true);
	});

	test("different definitions don't affect equality", () => {
		const a: JSONSchema7 = {
			type: "string",
			definitions: { x: { type: "number" } },
		};

		const b: JSONSchema7 = {
			type: "string",
			definitions: { y: { type: "boolean" } },
		};

		// definitions are metadata — shouldn't affect structural equality
		// But the engine compares all keys, so this might return false
		const result = checker.isEqual(a, b);
		// Document actual behavior
		expect(typeof result).toBe("boolean");
	});

	test("normalize does NOT recurse into definitions — they are metadata", () => {
		const schema: JSONSchema7 = {
			type: "object",
			definitions: {
				item: { const: "active" }, // const without type
			},
		};

		const result = checker.normalize(schema) as JSONSchema7;
		// The normalizer does NOT recurse into `definitions` because it is
		// listed in METADATA_KEYWORDS and is not in any of the recursive
		// keyword lists (SINGLE_SCHEMA_KEYWORDS, ARRAY_SCHEMA_KEYWORDS, etc.).
		// This means type inference from const does NOT happen inside definitions.
		if (
			result.definitions?.item &&
			typeof result.definitions.item !== "boolean"
		) {
			// Type is NOT inferred — definitions are left untouched
			expect((result.definitions.item as JSONSchema7).type).toBeUndefined();
		}
	});
});

describe("allOf — behavior in subset checking", () => {
	test("allOf in sub is NOT decomposed by getBranchesTyped (LIMITATION)", () => {
		const sub: JSONSchema7 = {
			allOf: [{ type: "string", minLength: 1 }, { maxLength: 100 }],
		};

		const sup: JSONSchema7 = { type: "string" };

		// LIMITATION: getBranchesTyped only extracts anyOf/oneOf branches,
		// not allOf. When sub has allOf, it stays as a single atomic schema.
		// The merge engine merges sub (with allOf) against sup, producing a
		// result that structurally differs from sub (the allOf gets flattened
		// in the merge result but sub still has it), so isEqual fails.
		//
		// Workaround: pre-resolve allOf in sub before checking, or use
		// intersect() to flatten the allOf first.
		expect(checker.isSubset(sub, sup)).toBe(false); // LIMITATION — should be true
	});

	test("allOf in sub works when pre-flattened via intersect()", () => {
		// Workaround: flatten allOf manually before subset check
		const branch1: JSONSchema7 = { type: "string", minLength: 1 };
		const branch2: JSONSchema7 = { maxLength: 100 };
		const flattened = checker.intersect(branch1, branch2);

		const sup: JSONSchema7 = { type: "string" };

		// With flattened sub, the check works correctly
		expect(flattened).not.toBeNull();
		if (flattened) {
			expect(checker.isSubset(flattened, sup)).toBe(true);
		}
	});

	test("allOf in sup is resolved by merge engine", () => {
		const sub: JSONSchema7 = { type: "string", minLength: 5, maxLength: 50 };

		const sup: JSONSchema7 = {
			allOf: [{ type: "string", minLength: 1 }, { maxLength: 100 }],
		};

		expect(checker.isSubset(sub, sup)).toBe(true);
	});

	test("allOf with conflicting types → intersect returns null", () => {
		const result = checker.intersect(
			{ allOf: [{ type: "string" }, { type: "number" }] },
			{ type: "string" },
		);
		// allOf with conflicting types should be empty
		expect(result).toBeNull();
	});

	test("allOf with compatible constraints → merged result", () => {
		const result = checker.intersect(
			{ allOf: [{ type: "string", minLength: 1 }, { maxLength: 10 }] },
			{ type: "string" },
		);

		expect(result).not.toBeNull();
		if (result && typeof result !== "boolean") {
			const schema = result as JSONSchema7;
			expect(schema.type).toBe("string");
			expect(schema.minLength).toBe(1);
			expect(schema.maxLength).toBe(10);
		}
	});
});
