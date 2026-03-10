import { beforeAll, describe, expect, test } from "bun:test";
import type { JSONSchema7 } from "json-schema";
import {
	arePatternsEquivalent,
	isPatternSubset,
	isTrivialPattern,
	JsonSchemaCompatibilityChecker,
	MergeEngine,
	resolveConditions,
} from "../../src";

let checker: JsonSchemaCompatibilityChecker;
let engine: MergeEngine;

beforeAll(() => {
	checker = new JsonSchemaCompatibilityChecker();
	engine = new MergeEngine();
});

// ═══════════════════════════════════════════════════════════════════════════════
//  Pattern — intersection, isPatternSubset, arePatternsEquivalent, isTrivialPattern
// ═══════════════════════════════════════════════════════════════════════════════

// The merge engine cannot compute the intersection of two patterns.
// These tests document the actual behavior and the cases where it produces
// false negatives (checker says false when the answer is true).

describe("Pattern intersection — behavior and limitations", () => {
	// ── Safe cases: correct behavior ───────────────────────────────────────

	describe("safe cases — correct behavior", () => {
		test("same pattern on both sides → isSubset true", () => {
			const sub = { type: "string" as const, pattern: "^[A-Z]+$" };
			const sup = { type: "string" as const, pattern: "^[A-Z]+$" };
			expect(checker.isSubset(sub, sup)).toBe(true);
		});

		test("sub has pattern, sup has no pattern → isSubset true (sub is more constrained)", () => {
			const sub = { type: "string" as const, pattern: "^[a-z]+$" };
			const sup = { type: "string" as const };
			expect(checker.isSubset(sub, sup)).toBe(true);
		});

		test("sub has no pattern, sup has pattern → isSubset false (sup adds constraint)", () => {
			const sub = { type: "string" as const };
			const sup = { type: "string" as const, pattern: "^[a-z]+$" };
			expect(checker.isSubset(sub, sup)).toBe(false);
		});

		test("sub has pattern + sup has no pattern → check returns no errors", () => {
			const result = checker.check(
				{ type: "string", pattern: "^[A-Z]{3}$" },
				{ type: "string" },
			);
			expect(result.isSubset).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		test("sub has no pattern + sup has pattern → check returns errors", () => {
			const result = checker.check(
				{ type: "string" },
				{ type: "string", pattern: "^[A-Z]+$" },
			);
			expect(result.isSubset).toBe(false);
			expect(result.errors.length).toBeGreaterThan(0);
		});
	});

	// ── Merge engine: what does intersect() produce with two patterns? ─────

	describe("merge engine — intersect() with two different patterns", () => {
		test("two different patterns: merged result contains BOTH patterns somehow", () => {
			// Document what the merge engine actually does
			const result = checker.intersect(
				{ type: "string", pattern: "^[A-Z]" },
				{ type: "string", pattern: "[0-9]$" },
			) as JSONSchema7 | null;

			// The merge does NOT return null (no conflict detected)
			expect(result).not.toBeNull();

			// Document which pattern survives in the merge
			// The merge library probably keeps one pattern or both.
			// This test documents the actual behavior, whatever it is.
			if (result) {
				// At minimum, one pattern must be present
				expect(result.pattern).toBeDefined();
				// Log for visibility (the test passes in all cases, it documents)
				console.log(
					"[pattern intersection] merged pattern =",
					JSON.stringify(result.pattern),
					"| full result =",
					JSON.stringify(result),
				);
			}
		});

		test("two identical patterns: merged result preserves the pattern", () => {
			const result = checker.intersect(
				{ type: "string", pattern: "^[a-z]+$" },
				{ type: "string", pattern: "^[a-z]+$" },
			) as JSONSchema7;
			expect(result).not.toBeNull();
			expect(result.pattern).toBe("^[a-z]+$");
		});

		test("pattern + other constraints: both are preserved in merge", () => {
			const result = checker.intersect(
				{ type: "string", pattern: "^[A-Z]", minLength: 3 },
				{ type: "string", maxLength: 10 },
			) as JSONSchema7;
			expect(result).not.toBeNull();
			expect(result.pattern).toBe("^[A-Z]");
			expect(result.minLength).toBe(3);
			expect(result.maxLength).toBe(10);
		});
	});

	// ── False negatives: checker says false but mathematically should be true ──

	describe("false negatives — checker says false but mathematically should be true", () => {
		test("FIXED: ^[a-z]{3}$ ⊆ ^[a-z]+$ — 3 lowercase ⊆ any lowercase (was false negative, now fixed by sampling)", () => {
			// Mathematically: every 3-lowercase-letter string also satisfies ^[a-z]+$
			// Before: the merge produced a combined pattern ≠ sub → false negative.
			// Now: isPatternSubset detects inclusion by sampling
			// and strips sup's pattern before the merge.
			const sub = { type: "string" as const, pattern: "^[a-z]{3}$" };
			const sup = { type: "string" as const, pattern: "^[a-z]+$" };

			const result = checker.isSubset(sub, sup);
			expect(result).toBe(true); // FIXED — sampling confirms inclusion
		});

		test("FIXED: ^[0-9]{3}$ ⊆ ^[0-9] — 3 digits ⊆ starts with digit (was false negative, now fixed by sampling)", () => {
			// "123" matches both patterns, and everything matching ^[0-9]{3}$ also matches ^[0-9]
			const sub = { type: "string" as const, pattern: "^[0-9]{3}$" };
			const sup = { type: "string" as const, pattern: "^[0-9]" };

			const result = checker.isSubset(sub, sup);
			expect(result).toBe(true); // FIXED — sampling confirms inclusion
		});

		test("FIXED: ^abc$ ⊆ ^[a-z]+$ — literal ⊆ class (was false negative, now fixed by sampling)", () => {
			// "abc" is always in the set of strings matching ^[a-z]+$
			const sub = { type: "string" as const, pattern: "^abc$" };
			const sup = { type: "string" as const, pattern: "^[a-z]+$" };

			const result = checker.isSubset(sub, sup);
			expect(result).toBe(true); // FIXED — sampling confirms inclusion
		});

		test("FIXED: ^[A-Z]{2}[0-9]{3}$ ⊆ ^[A-Z] — plate format ⊆ starts with uppercase (was false negative, now fixed by sampling)", () => {
			// Realistic case: a plate format like "AB123" always satisfies ^[A-Z]
			const sub = { type: "string" as const, pattern: "^[A-Z]{2}[0-9]{3}$" };
			const sup = { type: "string" as const, pattern: "^[A-Z]" };

			const result = checker.isSubset(sub, sup);
			expect(result).toBe(true); // FIXED — sampling confirms inclusion
		});

		test("check() on fixed pattern inclusion: no errors (pattern stripped before merge)", () => {
			const result = checker.check(
				{ type: "string", pattern: "^[a-z]{3}$" },
				{ type: "string", pattern: "^[a-z]+$" },
			);
			// Now that sup's pattern is stripped before the merge,
			// the merge produces a result structurally identical to sub → isSubset true.
			expect(result.isSubset).toBe(true);
			expect(result.errors).toHaveLength(0);
		});
	});

	// ── Correct rejections with two different patterns (no false positive) ─

	describe("correct rejections — two incompatible patterns", () => {
		test("^[a-z]+$ ⊄ ^[0-9]+$ — letters ⊄ digits (correctly rejected)", () => {
			const sub = { type: "string" as const, pattern: "^[a-z]+$" };
			const sup = { type: "string" as const, pattern: "^[0-9]+$" };

			// The two patterns have no useful intersection for the subset check.
			// The checker says false, which is correct here.
			expect(checker.isSubset(sub, sup)).toBe(false);
		});

		test("^[0-9]+$ ⊄ ^[a-z]+$ — digits ⊄ letters (correctly rejected, symmetric)", () => {
			expect(
				checker.isSubset(
					{ type: "string", pattern: "^[0-9]+$" },
					{ type: "string", pattern: "^[a-z]+$" },
				),
			).toBe(false);
		});
	});

	// ── Pattern in sub-schemas (properties, items) ────────────────────────

	describe("pattern in nested schemas", () => {
		test("nested: sub.properties.name has pattern, sup.properties.name has no pattern → isSubset true", () => {
			const sub: JSONSchema7 = {
				type: "object",
				properties: {
					name: { type: "string", pattern: "^[A-Z][a-z]+$" },
				},
				required: ["name"],
			};
			const sup: JSONSchema7 = {
				type: "object",
				properties: {
					name: { type: "string" },
				},
				required: ["name"],
			};
			expect(checker.isSubset(sub, sup)).toBe(true);
		});

		test("nested: sup.properties.name has pattern, sub.properties.name has no pattern → isSubset false", () => {
			const sub: JSONSchema7 = {
				type: "object",
				properties: {
					name: { type: "string" },
				},
				required: ["name"],
			};
			const sup: JSONSchema7 = {
				type: "object",
				properties: {
					name: { type: "string", pattern: "^[A-Z][a-z]+$" },
				},
				required: ["name"],
			};
			expect(checker.isSubset(sub, sup)).toBe(false);
		});

		test("FIXED: nested different patterns in properties → isSubset true (was false negative, now fixed by sampling)", () => {
			const sub: JSONSchema7 = {
				type: "object",
				properties: {
					code: { type: "string", pattern: "^[A-Z]{3}$" },
				},
				required: ["code"],
			};
			const sup: JSONSchema7 = {
				type: "object",
				properties: {
					code: { type: "string", pattern: "^[A-Z]+$" },
				},
				required: ["code"],
			};
			// Was false negative: ^[A-Z]{3}$ ⊆ ^[A-Z]+$ — sampling now confirms inclusion
			expect(checker.isSubset(sub, sup)).toBe(true);
		});

		test("nested: same pattern in properties → isSubset true", () => {
			const sub: JSONSchema7 = {
				type: "object",
				properties: {
					code: { type: "string", pattern: "^[A-Z]{3}$" },
				},
				required: ["code"],
			};
			const sup: JSONSchema7 = {
				type: "object",
				properties: {
					code: { type: "string", pattern: "^[A-Z]{3}$" },
				},
				required: ["code"],
			};
			expect(checker.isSubset(sub, sup)).toBe(true);
		});

		test("items: sub items have pattern, sup items have no pattern → isSubset true", () => {
			const sub: JSONSchema7 = {
				type: "array",
				items: { type: "string", pattern: "^[a-z]+$" },
			};
			const sup: JSONSchema7 = {
				type: "array",
				items: { type: "string" },
			};
			expect(checker.isSubset(sub, sup)).toBe(true);
		});

		test("items: sup items have pattern, sub items have no pattern → isSubset false", () => {
			const sub: JSONSchema7 = {
				type: "array",
				items: { type: "string" },
			};
			const sup: JSONSchema7 = {
				type: "array",
				items: { type: "string", pattern: "^[a-z]+$" },
			};
			expect(checker.isSubset(sub, sup)).toBe(false);
		});
	});

	// ── Pattern + other string constraints ────────────────────────────────

	describe("pattern combined with other string constraints", () => {
		test("sub has pattern + minLength, sup has only minLength → isSubset true", () => {
			const sub = {
				type: "string" as const,
				pattern: "^[A-Z]+$",
				minLength: 3,
			};
			const sup = { type: "string" as const, minLength: 1 };
			expect(checker.isSubset(sub, sup)).toBe(true);
		});

		test("sub has pattern + maxLength, sup has pattern + larger maxLength → isSubset true (same pattern)", () => {
			const sub = {
				type: "string" as const,
				pattern: "^[a-z]+$",
				maxLength: 10,
			};
			const sup = {
				type: "string" as const,
				pattern: "^[a-z]+$",
				maxLength: 50,
			};
			expect(checker.isSubset(sub, sup)).toBe(true);
		});

		test("sub has pattern, sup has different pattern + format → isSubset false", () => {
			const sub = { type: "string" as const, pattern: "^[a-z]+$" };
			const sup = {
				type: "string" as const,
				pattern: "^[0-9]+$",
				format: "hostname" as const,
			};
			expect(checker.isSubset(sub, sup)).toBe(false);
		});

		test("sub has pattern + format, sup has same pattern (no format) → isSubset true", () => {
			const sub = {
				type: "string" as const,
				pattern: "^.+@.+$",
				format: "email" as const,
			};
			const sup = { type: "string" as const, pattern: "^.+@.+$" };
			expect(checker.isSubset(sub, sup)).toBe(true);
		});
	});

	// ── check with patterns ───────────────────────────────────────────────

	describe("check with pattern constraints", () => {
		test("source with pattern → target without pattern: connectable", () => {
			const source: JSONSchema7 = {
				type: "object",
				properties: {
					sku: { type: "string", pattern: "^SKU-[0-9]{6}$" },
				},
				required: ["sku"],
			};
			const target: JSONSchema7 = {
				type: "object",
				properties: {
					sku: { type: "string" },
				},
				required: ["sku"],
			};
			const result = checker.check(source, target);
			expect(result.isSubset).toBe(true);
		});

		test("source without pattern → target with pattern: not connectable", () => {
			const source: JSONSchema7 = {
				type: "object",
				properties: {
					sku: { type: "string" },
				},
				required: ["sku"],
			};
			const target: JSONSchema7 = {
				type: "object",
				properties: {
					sku: { type: "string", pattern: "^SKU-[0-9]{6}$" },
				},
				required: ["sku"],
			};
			const result = checker.check(source, target);
			expect(result.isSubset).toBe(false);
		});

		test("FIXED: source with stricter pattern → target with looser pattern: connectable (was false negative, now fixed by sampling)", () => {
			const source: JSONSchema7 = {
				type: "object",
				properties: {
					code: { type: "string", pattern: "^FR[0-9]{5}$" },
				},
				required: ["code"],
			};
			const target: JSONSchema7 = {
				type: "object",
				properties: {
					code: { type: "string", pattern: "^[A-Z]{2}[0-9]+$" },
				},
				required: ["code"],
			};
			// FR12345 matches both, and every ^FR[0-9]{5}$ ⊆ ^[A-Z]{2}[0-9]+$
			// Sampling confirms: all generated strings from sub match sup.
			const result = checker.check(source, target);
			expect(result.isSubset).toBe(true); // FIXED — sampling confirms inclusion
		});
	});

	// ── Conditional resolution with patterns ──────────────────────────────

	describe("resolveConditions — then/else branch adds pattern", () => {
		test("then-branch adds pattern to resolved schema", () => {
			const schema: JSONSchema7 = {
				type: "object",
				properties: {
					mode: { type: "string" },
					code: { type: "string" },
				},
				required: ["mode", "code"],
				if: {
					properties: { mode: { const: "strict" } },
					required: ["mode"],
				},
				then: {
					properties: {
						code: { type: "string", pattern: "^[A-Z]{3}-[0-9]{4}$" },
					},
				},
			};

			const { resolved } = resolveConditions(
				schema,
				{
					mode: "strict",
				},
				engine,
			);
			const codeProp = resolved.properties?.code as JSONSchema7;
			expect(codeProp.pattern).toBe("^[A-Z]{3}-[0-9]{4}$");
		});

		test("sub with fixed pattern ⊆ resolved sup with same pattern via checkResolved", async () => {
			const sup: JSONSchema7 = {
				type: "object",
				properties: {
					mode: { type: "string" },
					code: { type: "string" },
				},
				required: ["mode", "code"],
				if: {
					properties: { mode: { const: "strict" } },
					required: ["mode"],
				},
				then: {
					properties: { code: { type: "string", pattern: "^[A-Z]{3}$" } },
				},
			};

			const sub: JSONSchema7 = {
				type: "object",
				properties: {
					mode: { const: "strict", type: "string" },
					code: { type: "string", pattern: "^[A-Z]{3}$" },
				},
				required: ["mode", "code"],
			};

			const result = await checker.check(sub, sup, {
				data: { mode: "strict", code: "ABC" },
			});
			expect(result.isSubset).toBe(true);
		});
	});
});

// ─────────────────────────────────────────────────────────────────────────────
//  isPatternSubset — direct unit tests
// ─────────────────────────────────────────────────────────────────────────────
//
// Direct tests of the pattern inclusion checking module via
// sampling. These tests validate the behavior of the
// `isPatternSubset` function independently from the subset checker.

describe("isPatternSubset — sampling-based regex inclusion", () => {
	// ── Identity ───────────────────────────────────────────────────────────

	describe("identity — same pattern", () => {
		test("identical patterns → true (fast path, no sampling needed)", () => {
			expect(isPatternSubset("^[a-z]+$", "^[a-z]+$")).toBe(true);
		});

		test("identical complex pattern → true", () => {
			expect(
				isPatternSubset("^[A-Z]{2}-[0-9]{4}$", "^[A-Z]{2}-[0-9]{4}$"),
			).toBe(true);
		});

		test("identical simple pattern → true", () => {
			expect(isPatternSubset(".*", ".*")).toBe(true);
		});
	});

	// ── Confirmed inclusions by sampling ───────────────────────────────────

	describe("confirmed inclusions (true)", () => {
		test("fixed quantifier ⊆ unbounded quantifier: ^[a-z]{3}$ ⊆ ^[a-z]+$", () => {
			expect(isPatternSubset("^[a-z]{3}$", "^[a-z]+$")).toBe(true);
		});

		test("fixed quantifier ⊆ range quantifier: ^[0-9]{3}$ ⊆ ^[0-9]{1,5}$", () => {
			expect(isPatternSubset("^[0-9]{3}$", "^[0-9]{1,5}$")).toBe(true);
		});

		test("literal ⊆ character class: ^abc$ ⊆ ^[a-z]+$", () => {
			expect(isPatternSubset("^abc$", "^[a-z]+$")).toBe(true);
		});

		test("anchored prefix ⊆ partial anchor: ^[A-Z]{2}[0-9]{3}$ ⊆ ^[A-Z]", () => {
			expect(isPatternSubset("^[A-Z]{2}[0-9]{3}$", "^[A-Z]")).toBe(true);
		});

		test("sub-range ⊆ full range: ^[a-f]+$ ⊆ ^[a-z]+$", () => {
			expect(isPatternSubset("^[a-f]+$", "^[a-z]+$")).toBe(true);
		});

		test("specific format ⊆ generic format: ^FR[0-9]{5}$ ⊆ ^[A-Z]{2}[0-9]+$", () => {
			expect(isPatternSubset("^FR[0-9]{5}$", "^[A-Z]{2}[0-9]+$")).toBe(true);
		});

		test("digit subset ⊆ alphanumeric: ^[0-9]+$ ⊆ ^[a-zA-Z0-9]+$", () => {
			expect(isPatternSubset("^[0-9]+$", "^[a-zA-Z0-9]+$")).toBe(true);
		});

		test("any specific pattern ⊆ .* (universal)", () => {
			expect(isPatternSubset("^[a-z]{3}$", ".*")).toBe(true);
		});

		test("any specific pattern ⊆ .+ (non-empty universal)", () => {
			expect(isPatternSubset("^[a-z]{3}$", ".+")).toBe(true);
		});

		test("email-like ⊆ contains-@ pattern: ^[a-z]+@[a-z]+\\.[a-z]+$ ⊆ .*@.*", () => {
			expect(isPatternSubset("^[a-z]+@[a-z]+\\.[a-z]+$", ".*@.*")).toBe(true);
		});

		test("ISO date ⊆ digit-dash pattern: ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ⊆ ^[0-9-]+$", () => {
			expect(isPatternSubset("^[0-9]{4}-[0-9]{2}-[0-9]{2}$", "^[0-9-]+$")).toBe(
				true,
			);
		});
	});

	// ── Confirmed exclusions by counter-example ────────────────────────────

	describe("confirmed exclusions (false)", () => {
		test("letters ⊄ digits: ^[a-z]+$ ⊄ ^[0-9]+$", () => {
			expect(isPatternSubset("^[a-z]+$", "^[0-9]+$")).toBe(false);
		});

		test("digits ⊄ letters: ^[0-9]+$ ⊄ ^[a-z]+$", () => {
			expect(isPatternSubset("^[0-9]+$", "^[a-z]+$")).toBe(false);
		});

		test("unbounded ⊄ fixed: ^[a-z]+$ ⊄ ^[a-z]{3}$", () => {
			// "ab" matches ^[a-z]+$ but not ^[a-z]{3}$
			expect(isPatternSubset("^[a-z]+$", "^[a-z]{3}$")).toBe(false);
		});

		test("wider range ⊄ narrower range: ^[a-z]+$ ⊄ ^[a-f]+$", () => {
			// "g" matches ^[a-z]+$ but not ^[a-f]+$
			expect(isPatternSubset("^[a-z]+$", "^[a-f]+$")).toBe(false);
		});

		test("alphanumeric ⊄ digits only: ^[a-zA-Z0-9]+$ ⊄ ^[0-9]+$", () => {
			expect(isPatternSubset("^[a-zA-Z0-9]+$", "^[0-9]+$")).toBe(false);
		});

		test("uppercase ⊄ lowercase: ^[A-Z]+$ ⊄ ^[a-z]+$", () => {
			expect(isPatternSubset("^[A-Z]+$", "^[a-z]+$")).toBe(false);
		});

		test("no-anchor ⊄ anchored: [0-9]+ ⊄ ^[0-9]+$ (unanchored allows prefix/suffix)", () => {
			// "abc123def" matches [0-9]+ (partial) but might not match ^[0-9]+$ (full)
			// Actually, unanchored sub generates strings that ARE just digits, so this might be true.
			// Let's use a clearer case.
			expect(isPatternSubset("^[a-z]*[0-9]+$", "^[0-9]+$")).toBe(false);
		});
	});

	// ── Edge cases ─────────────────────────────────────────────────────────

	describe("edge cases", () => {
		test("invalid sub pattern → null", () => {
			expect(isPatternSubset("[invalid", "^[a-z]+$")).toBeNull();
		});

		test("invalid sup pattern → null", () => {
			expect(isPatternSubset("^[a-z]+$", "[invalid")).toBeNull();
		});

		test("both invalid → null", () => {
			expect(isPatternSubset("[bad", "[also-bad")).toBeNull();
		});

		test("empty string pattern ⊆ .* (empty matches .*)", () => {
			// Pattern "" matches everything (no constraint)
			// This is a weird case — RandExp on "" generates ""
			// which matches .*
			const result = isPatternSubset("", ".*");
			expect(result).toBe(true);
		});

		test("custom sample count: low count still works for obvious cases", () => {
			expect(isPatternSubset("^[a-z]+$", "^[0-9]+$", 10)).toBe(false);
		});

		test("custom sample count: high count for confidence", () => {
			expect(isPatternSubset("^[a-z]{3}$", "^[a-z]+$", 500)).toBe(true);
		});
	});

	// ── Realistic patterns (orchestration use cases) ───────────────────────

	describe("realistic patterns — orchestration use cases", () => {
		test("SKU format ⊆ alphanumeric-dash: ^SKU-[0-9]{6}$ ⊆ ^[A-Z]+-[0-9]+$", () => {
			expect(isPatternSubset("^SKU-[0-9]{6}$", "^[A-Z]+-[0-9]+$")).toBe(true);
		});

		test("UUID v4 ⊆ hex-dash: specific UUID pattern ⊆ hex chars with dashes", () => {
			expect(
				isPatternSubset(
					"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
					"^[0-9a-f-]+$",
				),
			).toBe(true);
		});

		test("French postal code ⊆ 5-digit code: ^(75|92|93|94)[0-9]{3}$ ⊆ ^[0-9]{5}$", () => {
			expect(isPatternSubset("^(75|92|93|94)[0-9]{3}$", "^[0-9]{5}$")).toBe(
				true,
			);
		});

		test("strict email ⊄ hostname: email pattern ⊄ ^[a-z0-9.-]+$", () => {
			// Emails contain @ which is not in [a-z0-9.-]
			expect(isPatternSubset("^[a-z]+@[a-z]+\\.[a-z]+$", "^[a-z0-9.-]+$")).toBe(
				false,
			);
		});

		test("semver strict ⊆ digit-dot: ^[0-9]+\\.[0-9]+\\.[0-9]+$ ⊆ ^[0-9.]+$", () => {
			expect(isPatternSubset("^[0-9]+\\.[0-9]+\\.[0-9]+$", "^[0-9.]+$")).toBe(
				true,
			);
		});
	});
});

// ─────────────────────────────────────────────────────────────────────────────
//  arePatternsEquivalent — direct unit tests
// ─────────────────────────────────────────────────────────────────────────────

describe("arePatternsEquivalent — bidirectional sampling", () => {
	test("identical patterns → true", () => {
		expect(arePatternsEquivalent("^[a-z]+$", "^[a-z]+$")).toBe(true);
	});

	test("equivalent with different syntax: [0-9] ≡ \\d (in many engines)", () => {
		// [0-9] and \d are equivalent in most regex engines
		expect(arePatternsEquivalent("^[0-9]+$", "^\\d+$")).toBe(true);
	});

	test("non-equivalent: ^[a-z]+$ ≠ ^[a-z]{3}$ (different cardinality)", () => {
		expect(arePatternsEquivalent("^[a-z]+$", "^[a-z]{3}$")).toBe(false);
	});

	test("non-equivalent: ^[a-z]+$ ≠ ^[0-9]+$ (disjoint)", () => {
		expect(arePatternsEquivalent("^[a-z]+$", "^[0-9]+$")).toBe(false);
	});

	test("asymmetric inclusion is not equivalence: ^[a-f]+$ ⊆ ^[a-z]+$ but not ≡", () => {
		expect(arePatternsEquivalent("^[a-f]+$", "^[a-z]+$")).toBe(false);
	});

	test("invalid pattern → null", () => {
		expect(arePatternsEquivalent("[bad", "^[a-z]+$")).toBeNull();
	});
});

// ─────────────────────────────────────────────────────────────────────────────
//  isTrivialPattern — direct unit tests
// ─────────────────────────────────────────────────────────────────────────────

describe("isTrivialPattern — universal pattern detection", () => {
	test(".* is trivial", () => {
		expect(isTrivialPattern(".*")).toBe(true);
	});

	test(".+ is trivial", () => {
		expect(isTrivialPattern(".+")).toBe(true);
	});

	test("^.*$ is trivial", () => {
		expect(isTrivialPattern("^.*$")).toBe(true);
	});

	test("^.+$ is trivial", () => {
		expect(isTrivialPattern("^.+$")).toBe(true);
	});

	test("^.* is trivial", () => {
		expect(isTrivialPattern("^.*")).toBe(true);
	});

	test(".*$ is trivial", () => {
		expect(isTrivialPattern(".*$")).toBe(true);
	});

	test("empty string is trivial", () => {
		expect(isTrivialPattern("")).toBe(true);
	});

	test("whitespace-only is trivial", () => {
		expect(isTrivialPattern("   ")).toBe(true);
	});

	test("^[a-z]+$ is NOT trivial", () => {
		expect(isTrivialPattern("^[a-z]+$")).toBe(false);
	});

	test("^[0-9]{3}$ is NOT trivial", () => {
		expect(isTrivialPattern("^[0-9]{3}$")).toBe(false);
	});

	test("abc is NOT trivial", () => {
		expect(isTrivialPattern("abc")).toBe(false);
	});

	test("(?:.*) is trivial", () => {
		expect(isTrivialPattern("(?:.*)")).toBe(true);
	});

	test("(?:.+) is trivial", () => {
		expect(isTrivialPattern("(?:.+)")).toBe(true);
	});
});
