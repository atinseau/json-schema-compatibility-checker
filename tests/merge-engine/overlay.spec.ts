import { beforeAll, describe, expect, test } from "bun:test";
import type { JSONSchema7 } from "json-schema";
import { MergeEngine } from "../../src";

let engine: MergeEngine;

beforeAll(() => {
	engine = new MergeEngine();
});

// ── Overlay: sequential spread semantics ─────────────────────────────────────
//
// overlay(base, override) applies "last writer wins" per property.
// This is NON-commutative: overlay(A, B) ≠ overlay(B, A) in general.

describe("overlay — basic property spreading", () => {
	test("override replaces same-named property", () => {
		const base: JSONSchema7 = {
			type: "object",
			properties: {
				accountId: { type: "string", enum: ["salut", "coucou"] },
			},
			required: ["accountId"],
		};
		const override: JSONSchema7 = {
			type: "object",
			properties: {
				accountId: { type: "string" },
			},
			required: ["accountId"],
		};

		const result = engine.overlay(base, override) as JSONSchema7;

		expect(result.type).toBe("object");
		expect(result.properties).toEqual({
			accountId: { type: "string" },
		});
		expect(result.required).toEqual(["accountId"]);
	});

	test("base-only properties are preserved", () => {
		const base: JSONSchema7 = {
			type: "object",
			properties: {
				name: { type: "string" },
				age: { type: "integer" },
			},
			required: ["name", "age"],
		};
		const override: JSONSchema7 = {
			type: "object",
			properties: {
				name: { type: "string", minLength: 1 },
			},
			required: ["name"],
		};

		const result = engine.overlay(base, override) as JSONSchema7;

		expect(result.properties).toEqual({
			name: { type: "string", minLength: 1 },
			age: { type: "integer" },
		});
	});

	test("override-only properties are added", () => {
		const base: JSONSchema7 = {
			type: "object",
			properties: {
				name: { type: "string" },
			},
			required: ["name"],
		};
		const override: JSONSchema7 = {
			type: "object",
			properties: {
				email: { type: "string", format: "email" },
			},
			required: ["email"],
		};

		const result = engine.overlay(base, override) as JSONSchema7;

		expect(result.properties).toEqual({
			name: { type: "string" },
			email: { type: "string", format: "email" },
		});
		expect(result.required).toEqual(["name", "email"]);
	});

	test("empty base properties + override with properties", () => {
		const base: JSONSchema7 = {
			type: "object",
			properties: {},
		};
		const override: JSONSchema7 = {
			type: "object",
			properties: {
				id: { type: "integer" },
			},
			required: ["id"],
		};

		const result = engine.overlay(base, override) as JSONSchema7;

		expect(result.properties).toEqual({ id: { type: "integer" } });
		expect(result.required).toEqual(["id"]);
	});

	test("base with properties + empty override properties", () => {
		const base: JSONSchema7 = {
			type: "object",
			properties: {
				id: { type: "integer" },
			},
			required: ["id"],
		};
		const override: JSONSchema7 = {
			type: "object",
			properties: {},
		};

		const result = engine.overlay(base, override) as JSONSchema7;

		expect(result.properties).toEqual({ id: { type: "integer" } });
		expect(result.required).toEqual(["id"]);
	});
});

// ── Non-commutativity ────────────────────────────────────────────────────────

describe("overlay — non-commutativity", () => {
	test("overlay(A, B) ≠ overlay(B, A) when property types differ", () => {
		const schemaA: JSONSchema7 = {
			type: "object",
			properties: {
				value: { type: "string", enum: ["a", "b"] },
			},
			required: ["value"],
		};
		const schemaB: JSONSchema7 = {
			type: "object",
			properties: {
				value: { type: "string" },
			},
			required: ["value"],
		};

		const ab = engine.overlay(schemaA, schemaB) as JSONSchema7;
		const ba = engine.overlay(schemaB, schemaA) as JSONSchema7;

		// A then B → B wins → no enum
		expect(ab.properties).toEqual({
			value: { type: "string" },
		});

		// B then A → A wins → enum preserved
		expect(ba.properties).toEqual({
			value: { type: "string", enum: ["a", "b"] },
		});
	});

	test("overlay(narrow, wide) widens — overlay(wide, narrow) narrows", () => {
		const narrow: JSONSchema7 = {
			type: "object",
			properties: {
				count: { type: "integer", minimum: 0, maximum: 10 },
			},
		};
		const wide: JSONSchema7 = {
			type: "object",
			properties: {
				count: { type: "integer" },
			},
		};

		const widened = engine.overlay(narrow, wide) as JSONSchema7;
		const narrowed = engine.overlay(wide, narrow) as JSONSchema7;

		expect(widened.properties).toEqual({ count: { type: "integer" } });
		expect(narrowed.properties).toEqual({
			count: { type: "integer", minimum: 0, maximum: 10 },
		});
	});
});

// ── Required merging (union) ─────────────────────────────────────────────────

describe("overlay — required union", () => {
	test("required from both schemas are unioned", () => {
		const base: JSONSchema7 = {
			type: "object",
			properties: {
				a: { type: "string" },
				b: { type: "string" },
			},
			required: ["a"],
		};
		const override: JSONSchema7 = {
			type: "object",
			properties: {
				c: { type: "string" },
			},
			required: ["c"],
		};

		const result = engine.overlay(base, override) as JSONSchema7;

		expect(result.required).toEqual(["a", "c"]);
	});

	test("duplicate required keys are deduplicated", () => {
		const base: JSONSchema7 = {
			type: "object",
			properties: {
				id: { type: "string" },
			},
			required: ["id"],
		};
		const override: JSONSchema7 = {
			type: "object",
			properties: {
				id: { type: "integer" },
			},
			required: ["id"],
		};

		const result = engine.overlay(base, override) as JSONSchema7;

		expect(result.required).toEqual(["id"]);
	});

	test("no required on either side → no required in result", () => {
		const base: JSONSchema7 = {
			type: "object",
			properties: { a: { type: "string" } },
		};
		const override: JSONSchema7 = {
			type: "object",
			properties: { b: { type: "string" } },
		};

		const result = engine.overlay(base, override) as JSONSchema7;

		expect(result.required).toBeUndefined();
	});

	test("required only on base → preserved", () => {
		const base: JSONSchema7 = {
			type: "object",
			properties: { a: { type: "string" } },
			required: ["a"],
		};
		const override: JSONSchema7 = {
			type: "object",
			properties: { b: { type: "string" } },
		};

		const result = engine.overlay(base, override) as JSONSchema7;

		expect(result.required).toEqual(["a"]);
	});

	test("required only on override → preserved", () => {
		const base: JSONSchema7 = {
			type: "object",
			properties: { a: { type: "string" } },
		};
		const override: JSONSchema7 = {
			type: "object",
			properties: { b: { type: "string" } },
			required: ["b"],
		};

		const result = engine.overlay(base, override) as JSONSchema7;

		expect(result.required).toEqual(["b"]);
	});
});

// ── Object-level keyword override ────────────────────────────────────────────

describe("overlay — object-level keywords", () => {
	test("additionalProperties from override wins", () => {
		const base: JSONSchema7 = {
			type: "object",
			properties: { a: { type: "string" } },
			additionalProperties: true,
		};
		const override: JSONSchema7 = {
			type: "object",
			properties: { b: { type: "string" } },
			additionalProperties: false,
		};

		const result = engine.overlay(base, override) as JSONSchema7;

		expect(result.additionalProperties).toBe(false);
	});

	test("additionalProperties from base kept when override doesn't specify", () => {
		const base: JSONSchema7 = {
			type: "object",
			properties: { a: { type: "string" } },
			additionalProperties: false,
		};
		const override: JSONSchema7 = {
			type: "object",
			properties: { b: { type: "string" } },
		};

		const result = engine.overlay(base, override) as JSONSchema7;

		expect(result.additionalProperties).toBe(false);
	});

	test("minProperties from override wins", () => {
		const base: JSONSchema7 = {
			type: "object",
			properties: { a: { type: "string" } },
			minProperties: 1,
		};
		const override: JSONSchema7 = {
			type: "object",
			properties: { b: { type: "string" } },
			minProperties: 2,
		};

		const result = engine.overlay(base, override) as JSONSchema7;

		expect(result.minProperties).toBe(2);
	});

	test("maxProperties from override wins", () => {
		const base: JSONSchema7 = {
			type: "object",
			properties: { a: { type: "string" } },
			maxProperties: 10,
		};
		const override: JSONSchema7 = {
			type: "object",
			properties: {},
			maxProperties: 5,
		};

		const result = engine.overlay(base, override) as JSONSchema7;

		expect(result.maxProperties).toBe(5);
	});

	test("propertyNames from override wins", () => {
		const base: JSONSchema7 = {
			type: "object",
			propertyNames: { pattern: "^[a-z]+$" },
		};
		const override: JSONSchema7 = {
			type: "object",
			propertyNames: { pattern: "^[a-zA-Z]+$" },
		};

		const result = engine.overlay(base, override) as JSONSchema7;

		expect(result.propertyNames).toEqual({ pattern: "^[a-zA-Z]+$" });
	});

	test("patternProperties from override wins", () => {
		const base: JSONSchema7 = {
			type: "object",
			patternProperties: {
				"^x-": { type: "string" },
			},
		};
		const override: JSONSchema7 = {
			type: "object",
			patternProperties: {
				"^x-": { type: "integer" },
			},
		};

		const result = engine.overlay(base, override) as JSONSchema7;

		expect(result.patternProperties).toEqual({
			"^x-": { type: "integer" },
		});
	});

	test("dependencies from override wins", () => {
		const base: JSONSchema7 = {
			type: "object",
			properties: { a: { type: "string" }, b: { type: "string" } },
			dependencies: { a: ["b"] },
		};
		const override: JSONSchema7 = {
			type: "object",
			properties: { c: { type: "string" } },
			dependencies: { a: ["c"] },
		};

		const result = engine.overlay(base, override) as JSONSchema7;

		expect(result.dependencies).toEqual({ a: ["c"] });
	});

	test("type from override wins when explicitly set", () => {
		const base: JSONSchema7 = {
			type: "object",
			properties: { a: { type: "string" } },
		};
		const override: JSONSchema7 = {
			type: "object",
			properties: { a: { type: "integer" } },
		};

		const result = engine.overlay(base, override) as JSONSchema7;

		expect(result.type).toBe("object");
		expect(result.properties).toEqual({ a: { type: "integer" } });
	});
});

// ── Boolean schema handling ──────────────────────────────────────────────────

describe("overlay — boolean schemas", () => {
	test("override = false → false (no values allowed)", () => {
		const base: JSONSchema7 = {
			type: "object",
			properties: { a: { type: "string" } },
		};
		const result = engine.overlay(base, false);
		expect(result).toBe(false);
	});

	test("override = true → true (accept everything)", () => {
		const base: JSONSchema7 = {
			type: "object",
			properties: { a: { type: "string" } },
		};
		const result = engine.overlay(base, true);
		expect(result).toBe(true);
	});

	test("base = false + real override → override wins", () => {
		const override: JSONSchema7 = {
			type: "object",
			properties: { a: { type: "string" } },
		};
		const result = engine.overlay(false, override);
		expect(result).toEqual(override);
	});

	test("base = true + real override → override wins", () => {
		const override: JSONSchema7 = {
			type: "object",
			properties: { a: { type: "string" } },
		};
		const result = engine.overlay(true, override);
		expect(result).toEqual(override);
	});

	test("both booleans: overlay(false, true) → true", () => {
		expect(engine.overlay(false, true)).toBe(true);
	});

	test("both booleans: overlay(true, false) → false", () => {
		expect(engine.overlay(true, false)).toBe(false);
	});
});

// ── Non-object schemas ───────────────────────────────────────────────────────

describe("overlay — non-object schemas", () => {
	test("string override replaces string base", () => {
		const base: JSONSchema7 = { type: "string", minLength: 5 };
		const override: JSONSchema7 = { type: "string" };

		const result = engine.overlay(base, override);

		expect(result).toEqual({ type: "string" });
	});

	test("integer override replaces string base", () => {
		const base: JSONSchema7 = { type: "string" };
		const override: JSONSchema7 = { type: "integer", minimum: 0 };

		const result = engine.overlay(base, override);

		expect(result).toEqual({ type: "integer", minimum: 0 });
	});

	test("non-object override replaces object base entirely", () => {
		const base: JSONSchema7 = {
			type: "object",
			properties: { name: { type: "string" } },
			required: ["name"],
		};
		const override: JSONSchema7 = { type: "string" };

		const result = engine.overlay(base, override);

		expect(result).toEqual({ type: "string" });
	});

	test("object override replaces non-object base entirely", () => {
		const base: JSONSchema7 = { type: "string" };
		const override: JSONSchema7 = {
			type: "object",
			properties: { id: { type: "integer" } },
		};

		const result = engine.overlay(base, override);

		expect(result).toEqual({
			type: "object",
			properties: { id: { type: "integer" } },
		});
	});
});

// ── Pipeline simulation (the original use case) ─────────────────────────────

describe("overlay — sequential pipeline simulation", () => {
	test("Node1 → Node2 → context: override widens enum to plain string", () => {
		const node1Output: JSONSchema7 = {
			type: "object",
			properties: {
				accountId: { type: "string", enum: ["salut", "coucou"] },
			},
			required: ["accountId"],
		};
		const node2Output: JSONSchema7 = {
			type: "object",
			properties: {
				accountId: { type: "string" },
			},
			required: ["accountId"],
		};

		// After Node2, the context should have plain string (no enum)
		const contextAfterNode2 = engine.overlay(
			node1Output,
			node2Output,
		) as JSONSchema7;

		expect(contextAfterNode2.properties).toEqual({
			accountId: { type: "string" },
		});

		// Now Node3 expects enum — the subset check should FAIL
		// because the context only guarantees "string" (no enum).
		// This is the core bug that overlay fixes.
		const _node3Input: JSONSchema7 = {
			type: "object",
			properties: {
				accountId: { type: "string", enum: ["salut", "coucou"] },
			},
			required: ["accountId"],
		};

		// Verify the overlay result does NOT contain enum
		const accountIdProp = (
			contextAfterNode2.properties as Record<string, JSONSchema7>
		).accountId as JSONSchema7;
		expect(accountIdProp).toBeDefined();
		expect(accountIdProp.enum).toBeUndefined();

		// Contrast: mergeOrThrow (intersection) would KEEP the enum — wrong!
		const mergedIntersection = engine.mergeOrThrow(
			node1Output,
			node2Output,
		) as JSONSchema7;
		const mergedAccountId = (
			mergedIntersection.properties as Record<string, JSONSchema7>
		).accountId as JSONSchema7;
		expect(mergedAccountId.enum).toEqual(["salut", "coucou"]);
	});

	test("3-node pipeline: accumulate via reduce", () => {
		const node1Output: JSONSchema7 = {
			type: "object",
			properties: {
				name: { type: "string", minLength: 1 },
				status: { type: "string", enum: ["active", "inactive"] },
			},
			required: ["name", "status"],
		};

		const node2Output: JSONSchema7 = {
			type: "object",
			properties: {
				status: { type: "string" }, // widens status
				email: { type: "string", format: "email" }, // adds new property
			},
			required: ["status", "email"],
		};

		const node3Output: JSONSchema7 = {
			type: "object",
			properties: {
				email: { type: "string" }, // widens email (drops format)
			},
			required: ["email"],
		};

		// Simulate: reduce([node1, node2, node3], overlay)
		const outputs = [node1Output, node2Output, node3Output];
		const context = outputs.reduce((acc, output) => {
			return engine.overlay(acc, output) as JSONSchema7;
		});

		expect(context.properties).toEqual({
			name: { type: "string", minLength: 1 }, // kept from node1
			status: { type: "string" }, // widened by node2
			email: { type: "string" }, // widened by node3
		});
		expect(context.required).toEqual(["name", "status", "email"]);
	});

	test("pipeline with const override", () => {
		const node1: JSONSchema7 = {
			type: "object",
			properties: {
				mode: { type: "string", const: "debug" },
			},
			required: ["mode"],
		};
		const node2: JSONSchema7 = {
			type: "object",
			properties: {
				mode: { type: "string", enum: ["debug", "release", "test"] },
			},
			required: ["mode"],
		};

		const result = engine.overlay(node1, node2) as JSONSchema7;

		// node2 widens from const to enum
		expect((result.properties as Record<string, JSONSchema7>).mode).toEqual({
			type: "string",
			enum: ["debug", "release", "test"],
		});
	});
});

// ── Edge cases ───────────────────────────────────────────────────────────────

describe("overlay — edge cases", () => {
	test("both schemas identical → result equals either", () => {
		const schema: JSONSchema7 = {
			type: "object",
			properties: {
				id: { type: "integer" },
			},
			required: ["id"],
		};

		const result = engine.overlay(schema, schema) as JSONSchema7;

		expect(result.properties).toEqual({ id: { type: "integer" } });
		expect(result.required).toEqual(["id"]);
	});

	test("empty object schemas", () => {
		const base: JSONSchema7 = { type: "object" };
		const override: JSONSchema7 = { type: "object" };

		const result = engine.overlay(base, override) as JSONSchema7;

		expect(result.type).toBe("object");
		expect(result.properties).toEqual({});
	});

	test("overlay with {} (empty schema) as override replaces non-object base", () => {
		const base: JSONSchema7 = { type: "string", minLength: 3 };
		const override: JSONSchema7 = {};

		// {} is not object-like, so override replaces entirely
		const result = engine.overlay(base, override);

		expect(result).toEqual({});
	});

	test("base without properties but with required + object override", () => {
		const base: JSONSchema7 = {
			type: "object",
			required: ["id"],
		};
		const override: JSONSchema7 = {
			type: "object",
			properties: {
				id: { type: "integer" },
				name: { type: "string" },
			},
			required: ["name"],
		};

		const result = engine.overlay(base, override) as JSONSchema7;

		expect(result.properties).toEqual({
			id: { type: "integer" },
			name: { type: "string" },
		});
		expect(result.required).toEqual(["id", "name"]);
	});

	test("object-like schema detected by properties keyword (no explicit type)", () => {
		const base: JSONSchema7 = {
			properties: {
				a: { type: "string" },
			},
		};
		const override: JSONSchema7 = {
			properties: {
				b: { type: "integer" },
			},
		};

		const result = engine.overlay(base, override) as JSONSchema7;

		expect(result.properties).toEqual({
			a: { type: "string" },
			b: { type: "integer" },
		});
	});

	test("object-like schema detected by required keyword", () => {
		const base: JSONSchema7 = {
			required: ["a"],
		};
		const override: JSONSchema7 = {
			type: "object",
			properties: {
				a: { type: "string" },
			},
		};

		const result = engine.overlay(base, override) as JSONSchema7;

		expect(result.properties).toEqual({ a: { type: "string" } });
		expect(result.required).toEqual(["a"]);
	});

	test("object-like schema detected by additionalProperties keyword", () => {
		const base: JSONSchema7 = {
			additionalProperties: false,
		};
		const override: JSONSchema7 = {
			type: "object",
			properties: { x: { type: "string" } },
		};

		const result = engine.overlay(base, override) as JSONSchema7;

		expect(result.properties).toEqual({ x: { type: "string" } });
		// additionalProperties from base is preserved (override doesn't set it)
		expect(result.additionalProperties).toBe(false);
	});

	test("many properties with selective override", () => {
		const base: JSONSchema7 = {
			type: "object",
			properties: {
				a: { type: "string" },
				b: { type: "integer" },
				c: { type: "boolean" },
				d: { type: "number" },
				e: { type: "array", items: { type: "string" } },
			},
			required: ["a", "b", "c"],
		};
		const override: JSONSchema7 = {
			type: "object",
			properties: {
				b: { type: "number" }, // widen integer → number
				e: { type: "array", items: { type: "integer" } }, // change items type
			},
			required: ["e"],
		};

		const result = engine.overlay(base, override) as JSONSchema7;

		expect(result.properties).toEqual({
			a: { type: "string" },
			b: { type: "number" },
			c: { type: "boolean" },
			d: { type: "number" },
			e: { type: "array", items: { type: "integer" } },
		});
		expect(result.required).toEqual(["a", "b", "c", "e"]);
	});
});

// ── Immutability ─────────────────────────────────────────────────────────────

describe("overlay — immutability", () => {
	test("does not mutate the base schema", () => {
		const base: JSONSchema7 = {
			type: "object",
			properties: {
				id: { type: "string", enum: ["a", "b"] },
			},
			required: ["id"],
		};
		const baseCopy = JSON.parse(JSON.stringify(base));

		const override: JSONSchema7 = {
			type: "object",
			properties: {
				id: { type: "string" },
			},
		};

		engine.overlay(base, override);

		expect(base).toEqual(baseCopy);
	});

	test("does not mutate the override schema", () => {
		const base: JSONSchema7 = {
			type: "object",
			properties: {
				name: { type: "string" },
			},
		};

		const override: JSONSchema7 = {
			type: "object",
			properties: {
				name: { type: "string", minLength: 1 },
				age: { type: "integer" },
			},
			required: ["name", "age"],
		};
		const overrideCopy = JSON.parse(JSON.stringify(override));

		engine.overlay(base, override);

		expect(override).toEqual(overrideCopy);
	});
});

// ── Contrast with merge (intersection) ───────────────────────────────────────

describe("overlay vs merge — semantic difference", () => {
	test("merge keeps narrowest constraint, overlay keeps last writer", () => {
		const schemaA: JSONSchema7 = {
			type: "object",
			properties: {
				value: { type: "string", enum: ["x", "y"] },
			},
			required: ["value"],
		};
		const schemaB: JSONSchema7 = {
			type: "object",
			properties: {
				value: { type: "string" },
			},
			required: ["value"],
		};

		// merge (intersection): keeps enum because it's narrower
		const merged = engine.merge(schemaA, schemaB) as JSONSchema7;
		const mergedValue = (merged.properties as Record<string, JSONSchema7>)
			.value as JSONSchema7;
		expect(mergedValue.enum).toEqual(["x", "y"]);

		// overlay: last writer (schemaB) wins → no enum
		const overlaid = engine.overlay(schemaA, schemaB) as JSONSchema7;
		const overlaidValue = (overlaid.properties as Record<string, JSONSchema7>)
			.value as JSONSchema7;
		expect(overlaidValue.enum).toBeUndefined();
		expect(overlaidValue).toEqual({ type: "string" });
	});

	test("merge is commutative, overlay is not", () => {
		const a: JSONSchema7 = {
			type: "object",
			properties: { x: { type: "integer", minimum: 0 } },
		};
		const b: JSONSchema7 = {
			type: "object",
			properties: { x: { type: "integer", minimum: 10 } },
		};

		// merge: commutative
		const mergeAB = engine.merge(a, b) as JSONSchema7;
		const mergeBA = engine.merge(b, a) as JSONSchema7;
		expect(mergeAB).toEqual(mergeBA);

		// overlay: NOT commutative
		const overlayAB = engine.overlay(a, b) as JSONSchema7;
		const overlayBA = engine.overlay(b, a) as JSONSchema7;

		expect(
			(overlayAB.properties as Record<string, JSONSchema7>).x?.minimum,
		).toBe(10);
		expect(
			(overlayBA.properties as Record<string, JSONSchema7>).x?.minimum,
		).toBe(0);
	});
});

// ── Deep nested object properties ────────────────────────────────────────────

describe("overlay — deep spread for nested objects", () => {
	test("nested object property is deep-spread (base-only sub-properties kept)", () => {
		const base: JSONSchema7 = {
			type: "object",
			properties: {
				config: {
					type: "object",
					properties: {
						host: { type: "string" },
						port: { type: "integer" },
					},
					required: ["host", "port"],
				},
			},
			required: ["config"],
		};
		const override: JSONSchema7 = {
			type: "object",
			properties: {
				config: {
					type: "object",
					properties: {
						host: { type: "string", format: "hostname" },
						// port is NOT in override → kept from base via deep spread
					},
				},
			},
		};

		const result = engine.overlay(base, override) as JSONSchema7;

		const configProp = (result.properties as Record<string, JSONSchema7>)
			.config;
		expect(configProp).toEqual({
			type: "object",
			properties: {
				host: { type: "string", format: "hostname" }, // override wins
				port: { type: "integer" }, // kept from base
			},
			required: ["host", "port"], // union
		});
	});

	test("deep spread: override adds new sub-property to nested object", () => {
		const base: JSONSchema7 = {
			type: "object",
			properties: {
				db: {
					type: "object",
					properties: {
						host: { type: "string" },
					},
					required: ["host"],
				},
			},
		};
		const override: JSONSchema7 = {
			type: "object",
			properties: {
				db: {
					type: "object",
					properties: {
						port: { type: "integer", minimum: 1 },
					},
					required: ["port"],
				},
			},
		};

		const result = engine.overlay(base, override) as JSONSchema7;

		const dbProp = (result.properties as Record<string, JSONSchema7>).db;
		expect(dbProp).toEqual({
			type: "object",
			properties: {
				host: { type: "string" }, // kept from base
				port: { type: "integer", minimum: 1 }, // added by override
			},
			required: ["host", "port"], // union
		});
	});

	test("deep spread: override widens a nested sub-property", () => {
		const base: JSONSchema7 = {
			type: "object",
			properties: {
				user: {
					type: "object",
					properties: {
						role: { type: "string", enum: ["admin", "user"] },
						name: { type: "string", minLength: 1 },
					},
					required: ["role", "name"],
				},
			},
		};
		const override: JSONSchema7 = {
			type: "object",
			properties: {
				user: {
					type: "object",
					properties: {
						role: { type: "string" }, // widens: drops enum
					},
				},
			},
		};

		const result = engine.overlay(base, override) as JSONSchema7;

		const userProp = (result.properties as Record<string, JSONSchema7>).user;
		expect(userProp).toEqual({
			type: "object",
			properties: {
				role: { type: "string" }, // widened by override
				name: { type: "string", minLength: 1 }, // kept from base
			},
			required: ["role", "name"], // union
		});
	});

	test("3-level deep recursion", () => {
		const base: JSONSchema7 = {
			type: "object",
			properties: {
				level1: {
					type: "object",
					properties: {
						level2: {
							type: "object",
							properties: {
								a: { type: "string" },
								b: { type: "integer" },
							},
							required: ["a", "b"],
						},
					},
				},
			},
		};
		const override: JSONSchema7 = {
			type: "object",
			properties: {
				level1: {
					type: "object",
					properties: {
						level2: {
							type: "object",
							properties: {
								a: { type: "string", minLength: 5 }, // override deepest leaf
								c: { type: "boolean" }, // add new deepest leaf
							},
						},
					},
				},
			},
		};

		const result = engine.overlay(base, override) as JSONSchema7;

		const level1 = (result.properties as Record<string, JSONSchema7>).level1;
		const level2 = (
			(level1 as JSONSchema7).properties as Record<string, JSONSchema7>
		).level2;
		expect(level2).toEqual({
			type: "object",
			properties: {
				a: { type: "string", minLength: 5 }, // override wins
				b: { type: "integer" }, // kept from base
				c: { type: "boolean" }, // added by override
			},
			required: ["a", "b"], // union
		});
	});

	test("deep spread: non-object override replaces nested object entirely", () => {
		const base: JSONSchema7 = {
			type: "object",
			properties: {
				data: {
					type: "object",
					properties: {
						x: { type: "string" },
						y: { type: "integer" },
					},
				},
			},
		};
		const override: JSONSchema7 = {
			type: "object",
			properties: {
				data: { type: "string" }, // replaces object with string
			},
		};

		const result = engine.overlay(base, override) as JSONSchema7;

		expect((result.properties as Record<string, JSONSchema7>).data).toEqual({
			type: "string",
		});
	});

	test("deep spread: object override replaces nested non-object entirely", () => {
		const base: JSONSchema7 = {
			type: "object",
			properties: {
				data: { type: "string" },
			},
		};
		const override: JSONSchema7 = {
			type: "object",
			properties: {
				data: {
					type: "object",
					properties: { id: { type: "integer" } },
				},
			},
		};

		const result = engine.overlay(base, override) as JSONSchema7;

		expect((result.properties as Record<string, JSONSchema7>).data).toEqual({
			type: "object",
			properties: { id: { type: "integer" } },
		});
	});

	test("deep spread: boolean sub-schema in override replaces object base", () => {
		const base: JSONSchema7 = {
			type: "object",
			properties: {
				nested: {
					type: "object",
					properties: { a: { type: "string" } },
				},
			},
		};
		const override: JSONSchema7 = {
			type: "object",
			properties: {
				nested: false as unknown as JSONSchema7,
			},
		};

		const result = engine.overlay(base, override) as JSONSchema7;

		expect((result.properties as Record<string, unknown>).nested).toBe(false);
	});

	test("deep spread: object-level keywords override at nested level", () => {
		const base: JSONSchema7 = {
			type: "object",
			properties: {
				config: {
					type: "object",
					properties: {
						host: { type: "string" },
					},
					additionalProperties: true,
				},
			},
		};
		const override: JSONSchema7 = {
			type: "object",
			properties: {
				config: {
					type: "object",
					properties: {
						port: { type: "integer" },
					},
					additionalProperties: false,
				},
			},
		};

		const result = engine.overlay(base, override) as JSONSchema7;

		const configProp = (result.properties as Record<string, JSONSchema7>)
			.config;
		expect(configProp).toEqual({
			type: "object",
			properties: {
				host: { type: "string" }, // kept from base
				port: { type: "integer" }, // added by override
			},
			additionalProperties: false, // override wins
		});
	});

	test("pipeline with deep spread: 3 nodes enriching nested objects", () => {
		const node1: JSONSchema7 = {
			type: "object",
			properties: {
				metadata: {
					type: "object",
					properties: {
						createdBy: { type: "string" },
					},
					required: ["createdBy"],
				},
			},
			required: ["metadata"],
		};
		const node2: JSONSchema7 = {
			type: "object",
			properties: {
				metadata: {
					type: "object",
					properties: {
						updatedAt: { type: "string", format: "date-time" },
					},
					required: ["updatedAt"],
				},
			},
		};
		const node3: JSONSchema7 = {
			type: "object",
			properties: {
				metadata: {
					type: "object",
					properties: {
						createdBy: { type: "string", enum: ["system"] }, // narrows
					},
				},
				status: { type: "string" }, // adds top-level prop
			},
			required: ["status"],
		};

		const outputs = [node1, node2, node3];
		const context = outputs.reduce((acc, output) => {
			return engine.overlay(acc, output) as JSONSchema7;
		});

		expect(context.properties).toEqual({
			metadata: {
				type: "object",
				properties: {
					createdBy: { type: "string", enum: ["system"] }, // narrowed by node3
					updatedAt: { type: "string", format: "date-time" }, // added by node2
				},
				required: ["createdBy", "updatedAt"], // union across all nodes
			},
			status: { type: "string" }, // added by node3
		});
		expect(context.required).toEqual(["metadata", "status"]);
	});
});

// ── additionalProperties as schema ───────────────────────────────────────────

describe("overlay — additionalProperties as schema", () => {
	test("additionalProperties schema from override replaces base", () => {
		const base: JSONSchema7 = {
			type: "object",
			properties: { a: { type: "string" } },
			additionalProperties: { type: "string" },
		};
		const override: JSONSchema7 = {
			type: "object",
			properties: { b: { type: "integer" } },
			additionalProperties: { type: "integer" },
		};

		const result = engine.overlay(base, override) as JSONSchema7;

		expect(result.additionalProperties).toEqual({ type: "integer" });
		expect(result.properties).toEqual({
			a: { type: "string" },
			b: { type: "integer" },
		});
	});
});
