import { beforeAll, describe, expect, test } from "bun:test";
import type { JSONSchema7 } from "json-schema";
import { JsonSchemaCompatibilityChecker } from "../../src";

let checker: JsonSchemaCompatibilityChecker;

beforeAll(() => {
	checker = new JsonSchemaCompatibilityChecker();
});

// ─────────────────────────────────────────────────────────────────────────────
//  check with conditions — combining resolution + subset check
//
//  With the `{ data }` API, `data` is used for condition resolution and
//  narrowing. Runtime validation (AJV + constraints) only runs when
//  `validate: true` is explicitly set.
// ─────────────────────────────────────────────────────────────────────────────

describe("check with conditions", () => {
	const conditionalSup: JSONSchema7 = {
		type: "object",
		properties: {
			kind: { type: "string" },
			value: {},
		},
		required: ["kind", "value"],
		if: {
			properties: { kind: { const: "text" } },
			required: ["kind"],
		},
		then: {
			properties: { value: { type: "string" } },
		},
		else: {
			properties: { value: { type: "number" } },
		},
	};

	test("sub matching then-branch ⊆ resolved sup (fixes false negative)", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				kind: { const: "text" },
				value: { type: "string", minLength: 1 },
			},
			required: ["kind", "value"],
		};

		// Without resolution: false (known limitation)
		expect(checker.isSubset(sub, conditionalSup)).toBe(false);

		// With resolution: true! data is a complete instance matching the then-branch.
		const result = checker.check(sub, conditionalSup, {
			data: { kind: "text", value: "hello" },
		});
		expect(result.isSubset).toBe(true);
		expect(result.resolvedSup.branch).toBe("then");
	});

	test("sub matching else-branch ⊆ resolved sup", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				kind: { const: "data" },
				value: { type: "number", minimum: 0 },
			},
			required: ["kind", "value"],
		};

		const result = checker.check(sub, conditionalSup, {
			data: { kind: "data", value: 42 },
		});
		expect(result.isSubset).toBe(true);
		expect(result.resolvedSup.branch).toBe("else");
	});

	test("sub violating resolved branch ⊄ resolved sup", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				kind: { const: "text" },
				value: { type: "number" }, // wrong! then-branch expects string
			},
			required: ["kind", "value"],
		};

		// data matches the then-branch resolution, but sub declares value: number
		// which conflicts with the resolved sup's value: string.
		// The static check detects the type mismatch after condition resolution.
		const result = checker.check(sub, conditionalSup, {
			data: { kind: "text", value: "hello" },
		});
		expect(result.isSubset).toBe(false);
	});

	test("returns resolvedSub and resolvedSup in result", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				kind: { const: "text" },
				value: { type: "string" },
			},
			required: ["kind", "value"],
		};

		const result = checker.check(sub, conditionalSup, {
			data: { kind: "text", value: "hello" },
		});

		expect(result.resolvedSub).toBeDefined();
		expect(result.resolvedSup).toBeDefined();
		expect(result.resolvedSup.resolved.if).toBeUndefined();
		expect(result.resolvedSup.discriminant).toEqual({ kind: "text" });
	});

	test("uses data for both sub and sup when data resolves conditions on both", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				kind: { const: "text" },
				value: { type: "string" },
			},
			required: ["kind", "value"],
			if: { properties: { kind: { const: "text" } }, required: ["kind"] },
			then: { properties: { value: { type: "string", minLength: 1 } } },
		};

		const result = checker.check(sub, conditionalSup, {
			data: { kind: "text", value: "hello" },
		});

		// Both resolved with { kind: "text", value: "hello" }
		expect(result.resolvedSub.branch).toBe("then");
		expect(result.resolvedSup.branch).toBe("then");
	});

	test("uses same data for both sub and sup resolution", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: { kind: { const: "text" }, value: { type: "string" } },
			required: ["kind", "value"],
		};

		// Same data resolves both sub and sup conditions identically
		const resultThen = checker.check(sub, conditionalSup, {
			data: { kind: "text", value: "hello" },
		});
		expect(resultThen.resolvedSup.branch).toBe("then");
		expect(resultThen.resolvedSub.branch).toBeNull(); // sub has no if/then/else

		// Different data value triggers else branch for both
		const subElse: JSONSchema7 = {
			type: "object",
			properties: { kind: { const: "other" }, value: { type: "number" } },
			required: ["kind", "value"],
		};
		const resultElse = checker.check(subElse, conditionalSup, {
			data: { kind: "other", value: 42 },
		});
		expect(resultElse.resolvedSup.branch).toBe("else");
	});

	// ── Real-world: form with conditional required ───────────────────────────

	test("business form output ⊆ conditional form schema (resolved)", () => {
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
			then: { required: ["companyName", "taxId"] },
			else: { required: ["firstName", "lastName"] },
		};

		// The output must be closed (additionalProperties: false) so it doesn't
		// allow values for firstName/lastName that could violate the sup's type
		// constraints. It must also declare the enum to match the sup's accountType.
		const businessOutput: JSONSchema7 = {
			type: "object",
			properties: {
				accountType: {
					const: "business",
					type: "string",
					enum: ["personal", "business"],
				},
				email: { type: "string", format: "email" },
				companyName: { type: "string", minLength: 1 },
				taxId: { type: "string", minLength: 1 },
			},
			required: ["accountType", "email", "companyName", "taxId"],
			additionalProperties: false,
		};

		// Without resolution: false (known limitation — if/then/else gets added)
		expect(checker.isSubset(businessOutput, formSchema)).toBe(false);

		// With resolution: true! Data is a complete business instance.
		const result = checker.check(businessOutput, formSchema, {
			data: {
				accountType: "business",
				email: "ceo@acme.com",
				companyName: "ACME Corp",
				taxId: "123-456-789",
			},
		});
		expect(result.isSubset).toBe(true);
	});

	test("personal form output ⊆ conditional form schema (resolved)", () => {
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
			then: { required: ["companyName", "taxId"] },
			else: { required: ["firstName", "lastName"] },
		};

		// Closed output that declares all properties matching the sup
		const personalOutput: JSONSchema7 = {
			type: "object",
			properties: {
				accountType: {
					const: "personal",
					type: "string",
					enum: ["personal", "business"],
				},
				email: { type: "string", format: "email" },
				firstName: { type: "string", minLength: 1 },
				lastName: { type: "string", minLength: 1 },
			},
			required: ["accountType", "email", "firstName", "lastName"],
			additionalProperties: false,
		};

		const result = checker.check(personalOutput, formSchema, {
			data: {
				accountType: "personal",
				email: "alice@example.com",
				firstName: "Alice",
				lastName: "Dupont",
			},
		});
		expect(result.isSubset).toBe(true);
		expect(result.resolvedSup.branch).toBe("else");
	});

	test("incomplete form output ⊄ conditional form schema (resolved)", () => {
		const formSchema: JSONSchema7 = {
			type: "object",
			properties: {
				accountType: { type: "string", enum: ["personal", "business"] },
				email: { type: "string" },
			},
			required: ["accountType", "email"],
			if: {
				properties: { accountType: { const: "business" } },
				required: ["accountType"],
			},
			then: { required: ["companyName"] },
			else: { required: ["firstName"] },
		};

		const incomplete: JSONSchema7 = {
			type: "object",
			properties: {
				accountType: { const: "business" },
				email: { type: "string" },
			},
			required: ["accountType", "email"],
			// Missing companyName!
		};

		const result = checker.check(incomplete, formSchema, {
			data: { accountType: "business", email: "test@example.com" },
		});
		expect(result.isSubset).toBe(false);
	});

	// ── Nested conditional with check + conditions ───────────────────────────

	test("nested conditional resolved via check with conditions", () => {
		const sup: JSONSchema7 = {
			type: "object",
			properties: {
				config: {
					type: "object",
					properties: {
						mode: { type: "string", enum: ["fast", "safe"] },
						retries: { type: "integer" },
					},
					required: ["mode"],
					if: {
						properties: { mode: { const: "safe" } },
						required: ["mode"],
					},
					then: {
						required: ["retries"],
						properties: { retries: { type: "integer", minimum: 3 } },
					},
				},
			},
			required: ["config"],
		};

		// Sub must include the enum on mode to match sup's property definition,
		// since the merge will add enum from sup otherwise.
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				config: {
					type: "object",
					properties: {
						mode: {
							const: "safe",
							type: "string",
							enum: ["fast", "safe"],
						},
						retries: { type: "integer", minimum: 5 },
					},
					required: ["mode", "retries"],
				},
			},
			required: ["config"],
		};

		const result = checker.check(sub, sup, {
			data: { config: { mode: "safe", retries: 5 } },
		});
		expect(result.isSubset).toBe(true);
	});

	// ── Partial data without validate — no runtime validation ───────────────

	test("partial data (missing required field) without validate → still passes static check", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				kind: { const: "text" },
				value: { type: "string", minLength: 1 },
			},
			required: ["kind", "value"],
		};

		// Data is missing `value`, but without `validate: true` only condition
		// resolution + narrowing + static check are performed.
		// The schemas are structurally compatible → isSubset: true.
		const result = checker.check(sub, conditionalSup, {
			data: { kind: "text" },
		});
		expect(result.isSubset).toBe(true);
	});

	// ── Partial data with validate: true triggers runtime validation failure ──

	test("partial data (missing required field) with validate: true → runtime validation fails", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: {
				kind: { const: "text" },
				value: { type: "string", minLength: 1 },
			},
			required: ["kind", "value"],
		};

		// Data is missing `value` — both sub and conditionalSup require it.
		// With `validate: true`, AJV catches this → isSubset: false with errors.
		const result = checker.check(sub, conditionalSup, {
			data: { kind: "text" },
			validate: true,
		});
		expect(result.isSubset).toBe(false);
		expect(result.errors.length).toBeGreaterThan(0);
	});
});
