import { beforeAll, describe, expect, test } from "bun:test";
import type { JSONSchema7 } from "json-schema";
import { JsonSchemaCompatibilityChecker } from "../../src";

let checker: JsonSchemaCompatibilityChecker;

beforeAll(() => {
	checker = new JsonSchemaCompatibilityChecker();
});

// ═══════════════════════════════════════════════════════════════════════════════
//  Format validation — hierarchy, conflicts, edge cases
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
//  Amélioration 4 — format : validation sémantique via class-validator
// ─────────────────────────────────────────────────────────────────────────────

describe("Amélioration 4 — format validation", () => {
	// ── 4.3 / 4.4 — Intégration evaluateCondition / evaluateNot ───────────
	// (déjà couvert dans Améliorations 1 et 2 ci-dessus)

	// ── 4.5 — Conflit format-vs-format dans le merge engine ────────────────

	describe("4.5 — hasFormatConflict", () => {
		test("Test E.1 : format ⊆ type → true (non-régression, géré nativement)", () => {
			const sub: JSONSchema7 = { type: "string", format: "email" };
			const sup: JSONSchema7 = { type: "string" };
			expect(checker.isSubset(sub, sup)).toBe(true);
		});

		test("Test E.2 : type ⊄ format → false (non-régression, géré nativement)", () => {
			const sub: JSONSchema7 = { type: "string" };
			const sup: JSONSchema7 = { type: "string", format: "email" };
			expect(checker.isSubset(sub, sup)).toBe(false);
		});

		test("Test E.3 : format identique → true (non-régression)", () => {
			const sub: JSONSchema7 = { type: "string", format: "uuid" };
			const sup: JSONSchema7 = { type: "string", format: "uuid" };
			expect(checker.isSubset(sub, sup)).toBe(true);
		});

		test("Test E.4 : formats incompatibles (email ∩ ipv4) → merge null", () => {
			const sub: JSONSchema7 = { type: "string", format: "email" };
			const sup: JSONSchema7 = { type: "string", format: "ipv4" };
			const result = checker.intersect(sub, sup);
			expect(result).toBeNull();
			expect(checker.isSubset(sub, sup)).toBe(false);
		});

		test("Test E.5 : format avec hiérarchie (email ⊆ idn-email) → true", () => {
			const sub: JSONSchema7 = { type: "string", format: "email" };
			const sup: JSONSchema7 = { type: "string", format: "idn-email" };
			// email ⊆ idn-email → pas de conflit format
			expect(checker.isSubset(sub, sup)).toBe(true);
		});

		test("hostname ⊆ idn-hostname (hiérarchie)", () => {
			const sub: JSONSchema7 = { type: "string", format: "hostname" };
			const sup: JSONSchema7 = { type: "string", format: "idn-hostname" };
			expect(checker.isSubset(sub, sup)).toBe(true);
		});

		test("uri ⊆ iri (hiérarchie)", () => {
			const sub: JSONSchema7 = { type: "string", format: "uri" };
			const sup: JSONSchema7 = { type: "string", format: "iri" };
			expect(checker.isSubset(sub, sup)).toBe(true);
		});

		test("uri-reference ⊆ iri-reference (hiérarchie)", () => {
			const sub: JSONSchema7 = { type: "string", format: "uri-reference" };
			const sup: JSONSchema7 = { type: "string", format: "iri-reference" };
			expect(checker.isSubset(sub, sup)).toBe(true);
		});

		test("idn-email ⊄ email (inverse de la hiérarchie)", () => {
			const sub: JSONSchema7 = { type: "string", format: "idn-email" };
			const sup: JSONSchema7 = { type: "string", format: "email" };
			// idn-email n'est PAS un sous-ensemble de email (c'est l'inverse)
			// Mais l'intersection idn-email ∩ email = email (le plus restrictif)
			// donc le merge ne retourne pas null — il retourne un résultat avec format email.
			// En revanche, isSubset est false car merged ≠ sub.
			expect(checker.isSubset(sub, sup)).toBe(false);
		});

		test("formats différents sans relation → merge null", () => {
			const result1 = checker.intersect(
				{ type: "string", format: "uuid" },
				{ type: "string", format: "email" },
			);
			expect(result1).toBeNull();

			const result2 = checker.intersect(
				{ type: "string", format: "ipv6" },
				{ type: "string", format: "hostname" },
			);
			expect(result2).toBeNull();
		});

		test("même format → merge préserve le format", () => {
			const result = checker.intersect(
				{ type: "string", format: "email" },
				{ type: "string", format: "email" },
			) as JSONSchema7;
			expect(result).not.toBeNull();
			expect(result.format).toBe("email");
		});

		test("un seul format → merge préserve le format (pas de conflit)", () => {
			const result = checker.intersect(
				{ type: "string", format: "email" },
				{ type: "string", minLength: 5 },
			) as JSONSchema7;
			expect(result).not.toBeNull();
			expect(result.format).toBe("email");
		});

		test("conflit format dans propriétés imbriquées → merge null", () => {
			const result = checker.intersect(
				{
					type: "object",
					properties: { contact: { type: "string", format: "email" } },
				},
				{
					type: "object",
					properties: { contact: { type: "string", format: "ipv4" } },
				},
			);
			expect(result).toBeNull();
		});

		test("conflit format dans items → merge null", () => {
			const result = checker.intersect(
				{ type: "array", items: { type: "string", format: "email" } },
				{ type: "array", items: { type: "string", format: "uuid" } },
			);
			expect(result).toBeNull();
		});
	});
});

// ─────────────────────────────────────────────────────────────────────────────
//  9. Format validation edge cases
//
//  The format-validator has known approximations. Test the boundaries.
// ─────────────────────────────────────────────────────────────────────────────

describe("format — edge cases and approximations", () => {
	test("idn-email behaves identically to email (approximation)", () => {
		const sub: JSONSchema7 = { type: "string", format: "email" };
		const sup: JSONSchema7 = { type: "string", format: "idn-email" };

		// email ⊆ idn-email in the hierarchy
		expect(checker.isSubset(sub, sup)).toBe(true);
	});

	test("idn-email ⊄ email (reverse hierarchy)", () => {
		const sub: JSONSchema7 = { type: "string", format: "idn-email" };
		const sup: JSONSchema7 = { type: "string", format: "email" };

		// idn-email is a superset of email, so idn-email ⊄ email
		// But since validators are identical, this is an approximation issue
		const result = checker.isSubset(sub, sup);
		expect(result).toBe(false);
	});

	test("format on non-string type — format only applies to strings in Draft 7", () => {
		const sub: JSONSchema7 = {
			type: "number",
			format: "email" as JSONSchema7["format"],
		};
		const sup: JSONSchema7 = { type: "number" };

		// Format on non-string is meaningless in Draft 7
		// The checker should still handle this gracefully
		expect(checker.isSubset(sub, sup)).toBe(true);
	});

	test("unknown format is handled gracefully", () => {
		const sub: JSONSchema7 = { type: "string", format: "custom-thing" };
		const sup: JSONSchema7 = { type: "string" };

		// Unknown format adds constraint → sub is more constrained
		const result = checker.isSubset(sub, sup);
		expect(typeof result).toBe("boolean");
	});

	test("two unknown formats — behavior when both have custom format", () => {
		const sub: JSONSchema7 = { type: "string", format: "custom-a" };
		const sup: JSONSchema7 = { type: "string", format: "custom-b" };

		// Different unknown formats → treated as conflict by format checker
		const result = checker.intersect(sub, sup);
		// The hasFormatConflict function returns true for unknown different formats
		expect(result).toBeNull();
	});

	test("same unknown format — no conflict", () => {
		const sub: JSONSchema7 = { type: "string", format: "custom-a" };
		const sup: JSONSchema7 = { type: "string", format: "custom-a" };

		expect(checker.isSubset(sub, sup)).toBe(true);
	});

	test("format hierarchy: uri ⊆ iri", () => {
		const sub: JSONSchema7 = { type: "string", format: "uri" };
		const sup: JSONSchema7 = { type: "string", format: "iri" };
		expect(checker.isSubset(sub, sup)).toBe(true);
	});

	test("format hierarchy: uri-reference ⊆ iri-reference", () => {
		const sub: JSONSchema7 = { type: "string", format: "uri-reference" };
		const sup: JSONSchema7 = { type: "string", format: "iri-reference" };
		expect(checker.isSubset(sub, sup)).toBe(true);
	});

	test("format hierarchy: hostname ⊆ idn-hostname", () => {
		const sub: JSONSchema7 = { type: "string", format: "hostname" };
		const sup: JSONSchema7 = { type: "string", format: "idn-hostname" };
		expect(checker.isSubset(sub, sup)).toBe(true);
	});

	test("date-time vs date — no hierarchy, should conflict", () => {
		const result = checker.intersect(
			{ type: "string", format: "date-time" },
			{ type: "string", format: "date" },
		);
		// date-time and date are different formats with no hierarchy
		expect(result).toBeNull();
	});

	test("format ⊆ type (email ⊆ string) — handled natively by merge", () => {
		const sub: JSONSchema7 = { type: "string", format: "email" };
		const sup: JSONSchema7 = { type: "string" };
		expect(checker.isSubset(sub, sup)).toBe(true);
	});

	test("type ⊄ format (string ⊄ email) — format adds constraint", () => {
		const sub: JSONSchema7 = { type: "string" };
		const sup: JSONSchema7 = { type: "string", format: "email" };
		expect(checker.isSubset(sub, sup)).toBe(false);
	});
});
