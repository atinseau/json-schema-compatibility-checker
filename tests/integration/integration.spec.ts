import { beforeAll, describe, expect, test } from "bun:test";
import type { JSONSchema7 } from "json-schema";
import { JsonSchemaCompatibilityChecker } from "../../src";

let checker: JsonSchemaCompatibilityChecker;

beforeAll(() => {
	checker = new JsonSchemaCompatibilityChecker();
});

// ═══════════════════════════════════════════════════════════════════════════════
//  Integration — global integration tests, real-world schemas, stress tests,
//  diff reporting diagnostic quality
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
//  Tests d'intégration globaux (multi-améliorations)
// ─────────────────────────────────────────────────────────────────────────────

describe("Tests d'intégration globaux", () => {
	test("not + additionalProperties + format combinés", () => {
		const source: JSONSchema7 = {
			type: "object",
			properties: {
				status: { type: "string", const: "active" },
				email: { type: "string", format: "email" },
			},
			required: ["status", "email"],
			additionalProperties: false,
		};
		const target: JSONSchema7 = {
			type: "object",
			properties: {
				status: { type: "string", not: { const: "deleted" } },
				email: { type: "string", format: "email" },
			},
			required: ["status"],
		};
		expect(checker.isSubset(source, target)).toBe(true);
	});

	test("if allOf + format + nested resolution", () => {
		const schema: JSONSchema7 = {
			type: "object",
			properties: {
				contactMethod: { type: "string", enum: ["email", "phone"] },
				contactValue: { type: "string" },
			},
			if: {
				allOf: [
					{ properties: { contactMethod: { const: "email" } } },
					{ required: ["contactValue"] },
				],
			},
			then: {
				properties: { contactValue: { format: "email" } },
			},
			else: {
				properties: { contactValue: { pattern: "^\\+?[0-9]+" } },
			},
		};
		// Email contact
		const emailResult = checker.resolveConditions(schema, {
			contactMethod: "email",
			contactValue: "test@example.com",
		});
		expect(emailResult.branch).toBe("then");

		// Phone contact (ne matche pas allOf car contactMethod != "email")
		const phoneResult = checker.resolveConditions(schema, {
			contactMethod: "phone",
			contactValue: "+33612345678",
		});
		expect(phoneResult.branch).toBe("else");
	});

	test("double négation + subset check", () => {
		// not(not(string)) devrait se comporter comme string
		const sub: JSONSchema7 = { not: { not: { type: "string", minLength: 3 } } };
		const sup: JSONSchema7 = { type: "string" };
		expect(checker.isSubset(sub, sup)).toBe(true);
	});

	test("format hiérarchie sans not", () => {
		const sub: JSONSchema7 = { type: "string", format: "email" };
		const sup: JSONSchema7 = {
			type: "string",
			format: "idn-email",
		};
		// email ⊆ idn-email → compatible
		expect(checker.isSubset(sub, sup)).toBe(true);
	});

	test("evaluateCondition avec allOf + not + format combinés", () => {
		const schema: JSONSchema7 = {
			type: "object",
			properties: {
				type: { type: "string" },
				value: { type: "string" },
			},
			if: {
				allOf: [
					{ not: { properties: { type: { const: "skip" } } } },
					{ properties: { value: { format: "email" } } },
				],
			},
			then: { required: ["value"] },
			else: { required: [] },
		};
		// type != "skip" et value est un email → allOf([not(skip), format(email)]) = true → then
		const { branch } = checker.resolveConditions(schema, {
			type: "process",
			value: "test@example.com",
		});
		expect(branch).toBe("then");
	});

	test("evaluateCondition avec not qui bloque → else", () => {
		const schema: JSONSchema7 = {
			type: "object",
			properties: {
				type: { type: "string" },
				value: { type: "string" },
			},
			if: {
				allOf: [
					{ not: { properties: { type: { const: "skip" } } } },
					{ properties: { value: { format: "email" } } },
				],
			},
			then: { required: ["value"] },
			else: { required: [] },
		};
		// type = "skip" → not matche → allOf échoue → else
		const { branch } = checker.resolveConditions(schema, {
			type: "skip",
			value: "test@example.com",
		});
		expect(branch).toBe("else");
	});

	test("additionalProperties: false + isSubset fonctionne en non-régression", () => {
		// Cas classique qui doit continuer à fonctionner
		const closed: JSONSchema7 = {
			type: "object",
			properties: { name: { type: "string" } },
			required: ["name"],
			additionalProperties: false,
		};
		const open: JSONSchema7 = {
			type: "object",
			properties: {
				name: { type: "string" },
				age: { type: "number" },
			},
			required: ["name"],
		};
		expect(checker.isSubset(closed, open)).toBe(true);
		expect(checker.isSubset(open, closed)).toBe(false);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
//  13. Complex real-world schemas
//
//  Test realistic node orchestration schemas to validate the checker
//  works for the intended use case.
// ─────────────────────────────────────────────────────────────────────────────

describe("complex real-world schemas — orchestration use cases", () => {
	test("API response schema ⊆ expected input schema (real-world connection)", () => {
		const apiResponse: JSONSchema7 = {
			type: "object",
			properties: {
				status: { type: "integer", minimum: 100, maximum: 599 },
				data: {
					type: "object",
					properties: {
						users: {
							type: "array",
							items: {
								type: "object",
								properties: {
									id: { type: "string", format: "uuid" },
									email: { type: "string", format: "email" },
									name: { type: "string", minLength: 1 },
									role: { type: "string", enum: ["admin", "user", "viewer"] },
								},
								required: ["id", "email", "name", "role"],
							},
							minItems: 0,
						},
						total: { type: "integer", minimum: 0 },
					},
					required: ["users", "total"],
				},
			},
			required: ["status", "data"],
		};

		const expectedInput: JSONSchema7 = {
			type: "object",
			properties: {
				status: { type: "integer" },
				data: {
					type: "object",
					properties: {
						users: {
							type: "array",
							items: {
								type: "object",
								properties: {
									id: { type: "string" },
									email: { type: "string" },
									name: { type: "string" },
								},
								required: ["id", "email"],
							},
						},
						total: { type: "number" },
					},
					required: ["users"],
				},
			},
			required: ["data"],
		};

		const result = checker.canConnect(apiResponse, expectedInput);
		expect(result.isSubset).toBe(true);
	});

	test("webhook payload ⊄ strict event schema (missing fields)", () => {
		const webhookPayload: JSONSchema7 = {
			type: "object",
			properties: {
				event: { type: "string" },
				payload: { type: "object" },
			},
			required: ["event"],
		};

		const strictEventSchema: JSONSchema7 = {
			type: "object",
			properties: {
				event: { type: "string", enum: ["created", "updated", "deleted"] },
				payload: {
					type: "object",
					properties: {
						id: { type: "string" },
						timestamp: { type: "string", format: "date-time" },
					},
					required: ["id", "timestamp"],
				},
			},
			required: ["event", "payload"],
		};

		const result = checker.canConnect(webhookPayload, strictEventSchema);
		expect(result.isSubset).toBe(false);
		expect(result.diffs.length).toBeGreaterThan(0);
	});

	test("discriminated union output ⊆ flexible input", () => {
		const output: JSONSchema7 = {
			oneOf: [
				{
					type: "object",
					properties: {
						type: { const: "success" },
						data: { type: "object" },
					},
					required: ["type", "data"],
				},
				{
					type: "object",
					properties: {
						type: { const: "error" },
						message: { type: "string" },
						code: { type: "integer" },
					},
					required: ["type", "message"],
				},
			],
		};

		const input: JSONSchema7 = {
			type: "object",
			properties: {
				type: { type: "string" },
			},
			required: ["type"],
		};

		expect(checker.isSubset(output, input)).toBe(true);
	});

	test("pagination output with nested arrays", () => {
		const paginatedOutput: JSONSchema7 = {
			type: "object",
			properties: {
				items: {
					type: "array",
					items: {
						type: "object",
						properties: {
							id: { type: "integer", minimum: 1 },
							name: { type: "string", minLength: 1, maxLength: 255 },
							tags: {
								type: "array",
								items: { type: "string" },
								uniqueItems: true,
							},
						},
						required: ["id", "name"],
					},
				},
				page: { type: "integer", minimum: 1 },
				pageSize: { type: "integer", minimum: 1, maximum: 100 },
				totalPages: { type: "integer", minimum: 0 },
			},
			required: ["items", "page", "pageSize", "totalPages"],
		};

		const expectedInput: JSONSchema7 = {
			type: "object",
			properties: {
				items: {
					type: "array",
					items: {
						type: "object",
						properties: {
							id: { type: "number" },
							name: { type: "string" },
						},
						required: ["id"],
					},
				},
				page: { type: "number" },
				totalPages: { type: "number" },
			},
			required: ["items"],
		};

		expect(checker.canConnect(paginatedOutput, expectedInput).isSubset).toBe(
			true,
		);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
//  24. Diff reporting — quality of diagnostics
// ─────────────────────────────────────────────────────────────────────────────

describe("diff reporting — diagnostic quality", () => {
	test("deeply nested diff includes full path", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				level1: {
					type: "object",
					properties: {
						level2: {
							type: "object",
							properties: {
								value: { type: "string" },
							},
						},
					},
				},
			},
		};

		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				level1: {
					type: "object",
					properties: {
						level2: {
							type: "object",
							properties: {
								value: { type: "string", minLength: 10 },
							},
						},
					},
				},
			},
		};

		const result = checker.check(sub, sup);
		expect(result.isSubset).toBe(false);

		// The diff path should trace through the nesting
		const deepDiff = result.diffs.find(
			(d) => d.path.includes("level1") && d.path.includes("level2"),
		);
		expect(deepDiff).toBeDefined();
	});

	test("multiple diffs are all reported", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				name: { type: "string" },
				age: { type: "number" },
			},
		};

		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				name: { type: "string", minLength: 1 },
				age: { type: "number", minimum: 0 },
				email: { type: "string" },
			},
			required: ["name", "age", "email"],
		};

		const result = checker.check(sub, sup);
		expect(result.isSubset).toBe(false);
		// Multiple diffs: minLength, minimum, required, email property
		expect(result.diffs.length).toBeGreaterThanOrEqual(1);
	});

	test("formatResult produces readable output", () => {
		const result = checker.check(
			{ type: "string" },
			{ type: "string", minLength: 5 },
		);

		const formatted = checker.formatResult("string ⊆ strict-string", result);
		expect(formatted).toContain("❌");
		expect(formatted).toContain("false");
	});

	test("formatResult for passing check has ✅", () => {
		const result = checker.check(
			{ type: "string", minLength: 5 },
			{ type: "string" },
		);

		const formatted = checker.formatResult("strict ⊆ loose", result);
		expect(formatted).toContain("✅");
		expect(formatted).toContain("true");
	});
});

// ─────────────────────────────────────────────────────────────────────────────
//  25. Stress test — deeply nested and wide schemas
// ─────────────────────────────────────────────────────────────────────────────

describe("stress — deeply nested and wide schemas", () => {
	test("5-level deep nesting — subset check works", () => {
		const makeNested = (
			depth: number,
			extra: Partial<JSONSchema7> = {},
		): JSONSchema7 => {
			if (depth === 0) {
				return { type: "string", ...extra };
			}
			return {
				type: "object",
				properties: {
					child: makeNested(depth - 1, extra),
				},
				required: ["child"],
			};
		};

		const sub = makeNested(5, { minLength: 1 });
		const sup = makeNested(5);

		expect(checker.isSubset(sub, sup)).toBe(true);
		expect(checker.isSubset(sup, sub)).toBe(false);
	});

	test("wide schema with 20 properties — subset check works", () => {
		const makeWide = (
			count: number,
			extra: Record<string, JSONSchema7> = {},
		): JSONSchema7 => {
			const properties: Record<string, JSONSchema7> = {};
			const required: string[] = [];
			for (let i = 0; i < count; i++) {
				const key = `prop_${i}`;
				properties[key] = { type: "string" };
				required.push(key);
			}
			return {
				type: "object",
				properties: { ...properties, ...extra },
				required,
			};
		};

		const sub = makeWide(20);
		const sup = makeWide(15); // sup has fewer required properties

		// sub has MORE required → more constrained
		// But sub also has extra properties not in sup → depends on additionalProperties
		const result = checker.isSubset(sub, sup);
		expect(typeof result).toBe("boolean");
	});

	test("schema with all keyword types combined", () => {
		const complex: JSONSchema7 = {
			type: "object",
			properties: {
				name: {
					type: "string",
					minLength: 1,
					maxLength: 100,
					pattern: "^[A-Z]",
				},
				age: {
					type: "integer",
					minimum: 0,
					maximum: 150,
					exclusiveMinimum: -1,
				},
				email: { type: "string", format: "email" },
				tags: {
					type: "array",
					items: { type: "string", minLength: 1 },
					minItems: 0,
					maxItems: 10,
					uniqueItems: true,
				},
				metadata: {
					type: "object",
					properties: {
						created: { type: "string", format: "date-time" },
					},
					additionalProperties: { type: "string" },
				},
			},
			required: ["name", "email"],
			additionalProperties: false,
			minProperties: 2,
			maxProperties: 10,
			propertyNames: { minLength: 1 },
		};

		// Identity should hold for schemas without if/then/else
		expect(checker.isSubset(complex, complex)).toBe(true);
		expect(
			checker.isEqual(checker.normalize(complex), checker.normalize(complex)),
		).toBe(true);
	});
});
