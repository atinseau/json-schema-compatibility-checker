import { beforeAll, describe, expect, test } from "bun:test";
import type { JSONSchema7 } from "json-schema";
import { JsonSchemaCompatibilityChecker } from "../../src";

let checker: JsonSchemaCompatibilityChecker;

beforeAll(() => {
	checker = new JsonSchemaCompatibilityChecker();
});

// ─────────────────────────────────────────────────────────────────────────────
//  checkResolved — combining resolution + subset check
// ─────────────────────────────────────────────────────────────────────────────

describe("checkResolved", () => {
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

		// With resolution: true!
		const result = checker.checkResolved(sub, conditionalSup, {
			kind: "text",
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

		const result = checker.checkResolved(sub, conditionalSup, {
			kind: "data",
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

		const result = checker.checkResolved(sub, conditionalSup, {
			kind: "text",
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

		const result = checker.checkResolved(sub, conditionalSup, {
			kind: "text",
		});

		expect(result.resolvedSub).toBeDefined();
		expect(result.resolvedSup).toBeDefined();
		expect(result.resolvedSup.resolved.if).toBeUndefined();
		expect(result.resolvedSup.discriminant).toEqual({ kind: "text" });
	});

	test("uses subData for both sub and sup when supData is omitted", () => {
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

		const result = checker.checkResolved(sub, conditionalSup, {
			kind: "text",
		});

		// Both resolved with { kind: "text" }
		expect(result.resolvedSub.branch).toBe("then");
		expect(result.resolvedSup.branch).toBe("then");
	});

	test("uses separate supData when provided", () => {
		const sub: JSONSchema7 = {
			type: "object",
			properties: { kind: { const: "text" }, value: { type: "string" } },
			required: ["kind", "value"],
		};

		const resultThen = checker.checkResolved(
			sub,
			conditionalSup,
			{ kind: "text" },
			{ kind: "text" },
		);
		expect(resultThen.resolvedSup.branch).toBe("then");

		const resultElse = checker.checkResolved(
			sub,
			conditionalSup,
			{ kind: "text" },
			{ kind: "other" },
		);
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

		// With resolution: true!
		const result = checker.checkResolved(businessOutput, formSchema, {
			accountType: "business",
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

		const result = checker.checkResolved(personalOutput, formSchema, {
			accountType: "personal",
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

		const result = checker.checkResolved(incomplete, formSchema, {
			accountType: "business",
		});
		expect(result.isSubset).toBe(false);
	});

	// ── Nested conditional with checkResolved ────────────────────────────────

	test("nested conditional resolved via checkResolved", () => {
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
					if: { properties: { mode: { const: "safe" } }, required: ["mode"] },
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
						mode: { const: "safe", type: "string", enum: ["fast", "safe"] },
						retries: { type: "integer", minimum: 5 },
					},
					required: ["mode", "retries"],
				},
			},
			required: ["config"],
		};

		const result = checker.checkResolved(sub, sup, {
			config: { mode: "safe" },
		});
		expect(result.isSubset).toBe(true);
	});
});
