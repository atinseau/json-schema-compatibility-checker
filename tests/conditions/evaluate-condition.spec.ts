import { beforeAll, describe, expect, test } from "bun:test";
import type { JSONSchema7 } from "json-schema";
import { JsonSchemaCompatibilityChecker } from "../../src";

let checker: JsonSchemaCompatibilityChecker;

beforeAll(() => {
	checker = new JsonSchemaCompatibilityChecker();
});

// ═══════════════════════════════════════════════════════════════════════════════
//  evaluateCondition — enrichment (Point 5) + extended evaluation (Amélioration 2)
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
//  Point 5 — enriched evaluateCondition
// ─────────────────────────────────────────────────────────────────────────────

describe("Point 5 — evaluateCondition enrichment", () => {
	test("minimum: age >= 18 with age=25 → then-branch", () => {
		const schema: JSONSchema7 = {
			type: "object",
			properties: { age: { type: "number" } },
			if: { properties: { age: { minimum: 18 } } },
			then: { required: ["consent"] },
		};
		const { branch } = checker.resolveConditions(schema, { age: 25 });
		expect(branch).toBe("then");
	});

	test("minimum: age >= 18 with age=10 → else-branch", () => {
		const schema: JSONSchema7 = {
			type: "object",
			properties: { age: { type: "number" } },
			if: { properties: { age: { minimum: 18 } } },
			then: { required: ["consent"] },
			else: { required: ["guardian"] },
		};
		const { branch } = checker.resolveConditions(schema, { age: 10 });
		expect(branch).toBe("else");
	});

	test("exclusiveMinimum: age > 17 with age=18 → then-branch", () => {
		const schema: JSONSchema7 = {
			type: "object",
			properties: { age: { type: "number" } },
			if: { properties: { age: { exclusiveMinimum: 17 } } },
			then: { required: ["consent"] },
		};
		const { branch } = checker.resolveConditions(schema, { age: 18 });
		expect(branch).toBe("then");
	});

	test("maximum: score <= 100 with score=50 → then-branch", () => {
		const schema: JSONSchema7 = {
			type: "object",
			properties: { score: { type: "number" } },
			if: { properties: { score: { maximum: 100 } } },
			then: { required: ["level"] },
		};
		const { branch } = checker.resolveConditions(schema, { score: 50 });
		expect(branch).toBe("then");
	});

	test("maximum: score <= 100 with score=150 → else-branch", () => {
		const schema: JSONSchema7 = {
			type: "object",
			properties: { score: { type: "number" } },
			if: { properties: { score: { maximum: 100 } } },
			then: { required: ["level"] },
			else: { required: ["warning"] },
		};
		const { branch } = checker.resolveConditions(schema, { score: 150 });
		expect(branch).toBe("else");
	});

	test("minLength: name.length >= 3 with name='Alice' → then-branch", () => {
		const schema: JSONSchema7 = {
			type: "object",
			properties: { name: { type: "string" } },
			if: { properties: { name: { minLength: 3 } } },
			then: { required: ["greeting"] },
		};
		const { branch } = checker.resolveConditions(schema, { name: "Alice" });
		expect(branch).toBe("then");
	});

	test("minLength: name.length >= 3 with name='Al' → else-branch", () => {
		const schema: JSONSchema7 = {
			type: "object",
			properties: { name: { type: "string" } },
			if: { properties: { name: { minLength: 3 } } },
			then: { required: ["greeting"] },
			else: { required: ["nickname"] },
		};
		const { branch } = checker.resolveConditions(schema, { name: "Al" });
		expect(branch).toBe("else");
	});

	test("pattern: ^[A-Z]{3}$ with code='ABC' → then-branch", () => {
		const schema: JSONSchema7 = {
			type: "object",
			properties: { code: { type: "string" } },
			if: { properties: { code: { pattern: "^[A-Z]{3}$" } } },
			then: { required: ["valid"] },
		};
		const { branch } = checker.resolveConditions(schema, { code: "ABC" });
		expect(branch).toBe("then");
	});

	test("pattern: ^[A-Z]{3}$ with code='abc' → else-branch", () => {
		const schema: JSONSchema7 = {
			type: "object",
			properties: { code: { type: "string" } },
			if: { properties: { code: { pattern: "^[A-Z]{3}$" } } },
			then: { required: ["valid"] },
			else: { required: ["invalid"] },
		};
		const { branch } = checker.resolveConditions(schema, { code: "abc" });
		expect(branch).toBe("else");
	});

	test("multipleOf: n % 5 === 0 with n=15 → then-branch", () => {
		const schema: JSONSchema7 = {
			type: "object",
			properties: { n: { type: "number" } },
			if: { properties: { n: { multipleOf: 5 } } },
			then: { required: ["fiveish"] },
		};
		const { branch } = checker.resolveConditions(schema, { n: 15 });
		expect(branch).toBe("then");
	});

	test("multipleOf: n % 5 === 0 with n=13 → else-branch", () => {
		const schema: JSONSchema7 = {
			type: "object",
			properties: { n: { type: "number" } },
			if: { properties: { n: { multipleOf: 5 } } },
			then: { required: ["fiveish"] },
			else: { required: ["notFive"] },
		};
		const { branch } = checker.resolveConditions(schema, { n: 13 });
		expect(branch).toBe("else");
	});

	test("minItems: tags.length >= 2 with tags=['a','b','c'] → then-branch", () => {
		const schema: JSONSchema7 = {
			type: "object",
			properties: { tags: { type: "array" } },
			if: { properties: { tags: { minItems: 2 } } },
			then: { required: ["hasTags"] },
		};
		const { branch } = checker.resolveConditions(schema, {
			tags: ["a", "b", "c"],
		});
		expect(branch).toBe("then");
	});

	test("minItems: tags.length >= 2 with tags=['a'] → else-branch", () => {
		const schema: JSONSchema7 = {
			type: "object",
			properties: { tags: { type: "array" } },
			if: { properties: { tags: { minItems: 2 } } },
			then: { required: ["hasTags"] },
			else: { required: ["noTags"] },
		};
		const { branch } = checker.resolveConditions(schema, { tags: ["a"] });
		expect(branch).toBe("else");
	});

	test("discriminant extraction collects minimum/pattern indicators", () => {
		const schema: JSONSchema7 = {
			type: "object",
			properties: { age: { type: "number" }, code: { type: "string" } },
			if: {
				properties: {
					age: { minimum: 18 },
					code: { pattern: "^[A-Z]+$" },
				},
			},
			then: { required: ["verified"] },
		};
		const { discriminant } = checker.resolveConditions(schema, {
			age: 25,
			code: "ABC",
		});
		expect(discriminant.age).toBe(25);
		expect(discriminant.code).toBe("ABC");
	});

	test("combined: type + minimum + maximum with matching data → then", () => {
		const schema: JSONSchema7 = {
			type: "object",
			properties: { age: { type: "number" } },
			if: {
				properties: {
					age: { type: "number", minimum: 18, maximum: 65 },
				},
			},
			then: { required: ["employable"] },
		};
		const { branch } = checker.resolveConditions(schema, { age: 30 });
		expect(branch).toBe("then");
	});
});

// ─────────────────────────────────────────────────────────────────────────────
//  Amélioration 2 — evaluateCondition : évaluation complète du if
// ─────────────────────────────────────────────────────────────────────────────

describe("Amélioration 2 — evaluateCondition étendu", () => {
	// ── 2.1 — if avec allOf ───────────────────────────────────────────────

	describe("2.1 — if avec allOf", () => {
		test("allOf dans if : toutes les entrées matchent → then-branch", () => {
			const schema: JSONSchema7 = {
				type: "object",
				properties: {
					type: { type: "string" },
					taxId: { type: "string" },
					companyName: { type: "string" },
				},
				if: {
					allOf: [
						{ properties: { type: { const: "business" } } },
						{ required: ["taxId"] },
					],
				},
				then: { required: ["companyName"] },
				else: { required: [] },
			};
			const { branch } = checker.resolveConditions(schema, {
				type: "business",
				taxId: "123",
			});
			expect(branch).toBe("then");
		});

		test("allOf dans if : une entrée ne matche pas → else-branch", () => {
			const schema: JSONSchema7 = {
				type: "object",
				properties: {
					type: { type: "string" },
					taxId: { type: "string" },
					companyName: { type: "string" },
				},
				if: {
					allOf: [
						{ properties: { type: { const: "business" } } },
						{ required: ["taxId"] },
					],
				},
				then: { required: ["companyName"] },
				else: { required: [] },
			};
			// type matche mais taxId absent → allOf échoue
			const { branch } = checker.resolveConditions(schema, {
				type: "business",
			});
			expect(branch).toBe("else");
		});

		test("Test B — if avec allOf + format (intégration)", () => {
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
			const result = checker.resolveConditions(schema, {
				contactMethod: "email",
				contactValue: "test@example.com",
			});
			expect(result.branch).toBe("then");
		});
	});

	// ── 2.2 — if avec anyOf ───────────────────────────────────────────────

	describe("2.2 — if avec anyOf", () => {
		test("anyOf dans if : une branche matche → then-branch", () => {
			const schema: JSONSchema7 = {
				type: "object",
				properties: {
					role: { type: "string" },
					permissions: { type: "array" },
				},
				if: {
					anyOf: [
						{ properties: { role: { const: "admin" } } },
						{ properties: { role: { const: "superadmin" } } },
					],
				},
				then: { required: ["permissions"] },
			};
			const { branch } = checker.resolveConditions(schema, {
				role: "admin",
			});
			expect(branch).toBe("then");
		});

		test("anyOf dans if : aucune branche ne matche → else-branch", () => {
			const schema: JSONSchema7 = {
				type: "object",
				properties: {
					role: { type: "string" },
					permissions: { type: "array" },
				},
				if: {
					anyOf: [
						{ properties: { role: { const: "admin" } } },
						{ properties: { role: { const: "superadmin" } } },
					],
				},
				then: { required: ["permissions"] },
				else: { required: [] },
			};
			const { branch } = checker.resolveConditions(schema, {
				role: "viewer",
			});
			expect(branch).toBe("else");
		});
	});

	// ── 2.3 — if avec oneOf ───────────────────────────────────────────────

	describe("2.3 — if avec oneOf", () => {
		test("oneOf dans if : exactement une branche matche → then-branch", () => {
			const schema: JSONSchema7 = {
				type: "object",
				properties: {
					mode: { type: "string" },
					output: { type: "string" },
				},
				if: {
					oneOf: [
						{ properties: { mode: { const: "debug" } } },
						{ properties: { mode: { const: "verbose" } } },
					],
				},
				then: { required: ["output"] },
			};
			const { branch } = checker.resolveConditions(schema, {
				mode: "debug",
			});
			expect(branch).toBe("then");
		});

		test("oneOf dans if : aucune branche ne matche → else-branch", () => {
			const schema: JSONSchema7 = {
				type: "object",
				properties: { mode: { type: "string" } },
				if: {
					oneOf: [
						{ properties: { mode: { const: "debug" } } },
						{ properties: { mode: { const: "verbose" } } },
					],
				},
				then: { required: ["output"] },
				else: { required: [] },
			};
			const { branch } = checker.resolveConditions(schema, {
				mode: "production",
			});
			expect(branch).toBe("else");
		});
	});

	// ── 2.4 — if avec not ─────────────────────────────────────────────────

	describe("2.4 — if avec not", () => {
		test("not dans if : contenu du not matche data → condition échoue → else", () => {
			const schema: JSONSchema7 = {
				type: "object",
				properties: {
					type: { type: "string" },
					companyName: { type: "string" },
				},
				if: {
					not: { properties: { type: { const: "personal" } } },
				},
				then: { required: ["companyName"] },
				else: { required: [] },
			};
			// type="personal" matche le contenu du not → not(true) = false → else
			const { branch } = checker.resolveConditions(schema, {
				type: "personal",
			});
			expect(branch).toBe("else");
		});

		test("not dans if : contenu du not ne matche pas → condition réussit → then", () => {
			const schema: JSONSchema7 = {
				type: "object",
				properties: {
					type: { type: "string" },
					companyName: { type: "string" },
				},
				if: {
					not: { properties: { type: { const: "personal" } } },
				},
				then: { required: ["companyName"] },
				else: { required: [] },
			};
			// type="business" ne matche pas le contenu du not → not(false) = true → then
			const { branch } = checker.resolveConditions(schema, {
				type: "business",
			});
			expect(branch).toBe("then");
		});
	});

	// ── 2.5 — Propriétés imbriquées ───────────────────────────────────────

	describe("2.5 — propriétés imbriquées (nested objects)", () => {
		test("nested property avec const matche → then-branch", () => {
			const schema: JSONSchema7 = {
				type: "object",
				properties: {
					address: {
						type: "object",
						properties: { country: { type: "string" } },
					},
					siret: { type: "string" },
				},
				if: {
					properties: {
						address: {
							properties: { country: { const: "FR" } },
							required: ["country"],
						},
					},
				},
				then: { required: ["siret"] },
			};
			const { branch } = checker.resolveConditions(schema, {
				address: { country: "FR" },
			});
			expect(branch).toBe("then");
		});

		test("nested property avec const différent → else-branch", () => {
			const schema: JSONSchema7 = {
				type: "object",
				properties: {
					address: {
						type: "object",
						properties: { country: { type: "string" } },
					},
					siret: { type: "string" },
				},
				if: {
					properties: {
						address: {
							properties: { country: { const: "FR" } },
							required: ["country"],
						},
					},
				},
				then: { required: ["siret"] },
				else: { required: [] },
			};
			const { branch } = checker.resolveConditions(schema, {
				address: { country: "US" },
			});
			expect(branch).toBe("else");
		});

		test("nested property avec data non-objet → skip (then par défaut)", () => {
			const schema: JSONSchema7 = {
				type: "object",
				properties: {
					address: { type: "object" },
					siret: { type: "string" },
				},
				if: {
					properties: {
						address: {
							properties: { country: { const: "FR" } },
						},
					},
				},
				then: { required: ["siret"] },
				else: { required: [] },
			};
			// address n'est pas un objet → le check nested est skippé → then
			const { branch } = checker.resolveConditions(schema, {
				address: "not-an-object",
			});
			expect(branch).toBe("then");
		});
	});

	// ── 2.6 — format dans evaluateCondition ───────────────────────────────

	describe("2.6 — format dans evaluateCondition", () => {
		test("Test F — valeur email valide → then-branch", () => {
			const schema: JSONSchema7 = {
				type: "object",
				properties: {
					contact: { type: "string" },
					contactLabel: { type: "string" },
				},
				if: {
					properties: { contact: { format: "email" } },
				},
				then: {
					properties: { contactLabel: { const: "Email" } },
				},
				else: {
					properties: { contactLabel: { const: "Other" } },
				},
			};
			const { branch } = checker.resolveConditions(schema, {
				contact: "user@example.com",
			});
			expect(branch).toBe("then");
		});

		test("Test F — valeur non-email → else-branch", () => {
			const schema: JSONSchema7 = {
				type: "object",
				properties: {
					contact: { type: "string" },
					contactLabel: { type: "string" },
				},
				if: {
					properties: { contact: { format: "email" } },
				},
				then: {
					properties: { contactLabel: { const: "Email" } },
				},
				else: {
					properties: { contactLabel: { const: "Other" } },
				},
			};
			const { branch } = checker.resolveConditions(schema, {
				contact: "not-an-email",
			});
			expect(branch).toBe("else");
		});

		test("Test F — valeur non-string → format skip → then", () => {
			const schema: JSONSchema7 = {
				type: "object",
				properties: {
					contact: {},
					contactLabel: { type: "string" },
				},
				if: {
					properties: { contact: { format: "email" } },
				},
				then: {
					properties: { contactLabel: { const: "Email" } },
				},
				else: {
					properties: { contactLabel: { const: "Other" } },
				},
			};
			// contact = 42 → typeof !== "string" → format check skippé → then
			const { branch } = checker.resolveConditions(schema, {
				contact: 42,
			});
			expect(branch).toBe("then");
		});

		test("format uuid valide → then-branch", () => {
			const schema: JSONSchema7 = {
				type: "object",
				properties: { id: { type: "string" } },
				if: {
					properties: { id: { format: "uuid" } },
				},
				then: { required: ["id"] },
			};
			const { branch } = checker.resolveConditions(schema, {
				id: "550e8400-e29b-41d4-a716-446655440000",
			});
			expect(branch).toBe("then");
		});

		test("format uuid invalide → else-branch", () => {
			const schema: JSONSchema7 = {
				type: "object",
				properties: { id: { type: "string" } },
				if: {
					properties: { id: { format: "uuid" } },
				},
				then: { required: ["id"] },
				else: { required: [] },
			};
			const { branch } = checker.resolveConditions(schema, {
				id: "not-a-uuid",
			});
			expect(branch).toBe("else");
		});

		test("format ipv4 valide → then-branch", () => {
			const schema: JSONSchema7 = {
				type: "object",
				properties: { ip: { type: "string" } },
				if: {
					properties: { ip: { format: "ipv4" } },
				},
				then: { required: ["ip"] },
			};
			const { branch } = checker.resolveConditions(schema, {
				ip: "192.168.1.1",
			});
			expect(branch).toBe("then");
		});

		test("format ipv4 invalide → else-branch", () => {
			const schema: JSONSchema7 = {
				type: "object",
				properties: { ip: { type: "string" } },
				if: {
					properties: { ip: { format: "ipv4" } },
				},
				then: { required: ["ip"] },
				else: { required: [] },
			};
			const { branch } = checker.resolveConditions(schema, {
				ip: "not-an-ip",
			});
			expect(branch).toBe("else");
		});

		test("format inconnu → skip → then (pas de faux négatif)", () => {
			const schema: JSONSchema7 = {
				type: "object",
				properties: { x: { type: "string" } },
				if: {
					properties: { x: { format: "unknown-custom-format" } },
				},
				then: { required: ["x"] },
				else: { required: [] },
			};
			const { branch } = checker.resolveConditions(schema, {
				x: "anything",
			});
			// Format inconnu → validateFormat retourne null → skip → then
			expect(branch).toBe("then");
		});
	});

	// ── format dans DISCRIMINANT_INDICATORS ───────────────────────────────

	test("format est dans les DISCRIMINANT_INDICATORS", () => {
		const schema: JSONSchema7 = {
			type: "object",
			properties: {
				email: { type: "string" },
			},
			if: {
				properties: { email: { format: "email" } },
			},
			then: { required: ["email"] },
		};
		const { discriminant } = checker.resolveConditions(schema, {
			email: "test@example.com",
		});
		expect(discriminant).toHaveProperty("email");
		expect(discriminant.email).toBe("test@example.com");
	});
});

describe("condition resolver — advanced evaluation", () => {
	test("evaluateCondition with nested object data", () => {
		const schema: JSONSchema7 = {
			type: "object",
			properties: {
				address: {
					type: "object",
					properties: {
						country: { type: "string" },
					},
				},
				vatId: { type: "string" },
			},
			if: {
				properties: {
					address: {
						properties: { country: { const: "FR" } },
						required: ["country"],
					},
				},
			},
			then: { required: ["vatId"] },
		};

		const frResult = checker.resolveConditions(schema, {
			address: { country: "FR" },
		});
		expect(frResult.branch).toBe("then");
		expect(frResult.resolved.required).toContain("vatId");

		const usResult = checker.resolveConditions(schema, {
			address: { country: "US" },
		});
		expect(usResult.branch).toBe("else");
	});

	test("evaluateCondition with array data — minItems check", () => {
		const schema: JSONSchema7 = {
			type: "object",
			properties: {
				items: { type: "array" },
				summary: { type: "string" },
			},
			if: {
				properties: {
					items: { minItems: 5 },
				},
			},
			then: { required: ["summary"] },
		};

		const manyItems = checker.resolveConditions(schema, {
			items: [1, 2, 3, 4, 5],
		});
		expect(manyItems.branch).toBe("then");
		expect(manyItems.resolved.required).toContain("summary");

		const fewItems = checker.resolveConditions(schema, {
			items: [1, 2],
		});
		expect(fewItems.branch).toBe("else");
	});

	test("evaluateCondition with format check (email)", () => {
		const schema: JSONSchema7 = {
			type: "object",
			properties: {
				contact: { type: "string" },
				label: { type: "string" },
			},
			if: {
				properties: { contact: { format: "email" } },
			},
			then: {
				properties: { label: { const: "Email" } },
			},
			else: {
				properties: { label: { const: "Other" } },
			},
		};

		const emailResult = checker.resolveConditions(schema, {
			contact: "test@example.com",
		});
		expect(emailResult.branch).toBe("then");

		const nonEmailResult = checker.resolveConditions(schema, {
			contact: "not-an-email",
		});
		expect(nonEmailResult.branch).toBe("else");
	});

	test("resolveConditions with missing data — absent property = skip", () => {
		const schema: JSONSchema7 = {
			type: "object",
			properties: {
				mode: { type: "string" },
				output: { type: "string" },
			},
			if: {
				properties: { mode: { const: "debug" } },
				// No "required" → mode is optional in the if check
			},
			then: {
				properties: { output: { type: "string", minLength: 100 } },
			},
		};

		// No data at all → mode is absent → properties check passes (absent = skip)
		// But required is not set in if, so the condition passes
		const result = checker.resolveConditions(schema, {});
		expect(result.branch).toBe("then");
	});

	test("resolveConditions with required in if — absent data fails", () => {
		const schema: JSONSchema7 = {
			type: "object",
			properties: {
				mode: { type: "string" },
			},
			if: {
				properties: { mode: { const: "debug" } },
				required: ["mode"], // mode MUST be present
			},
			then: { required: ["extra"] },
			else: {},
		};

		// mode is absent → required check fails → else branch
		const result = checker.resolveConditions(schema, {});
		expect(result.branch).toBe("else");
	});
});
