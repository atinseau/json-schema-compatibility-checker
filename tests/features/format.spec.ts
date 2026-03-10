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

// Formats not natively supported by ajv-formats — AJV silently ignores them
// so runtime validation cannot catch invalid values for these formats.
const _AJV_UNSUPPORTED_FORMATS = new Set([
	"idn-email",
	"idn-hostname",
	"iri",
	"iri-reference",
]);

function expectRuntimeFormatResult(
	format: NonNullable<JSONSchema7["format"]>,
	value: unknown,
	expected: boolean,
): void {
	const schema: JSONSchema7 = { type: "string", format };
	const result = checker.check(schema, schema, {
		data: value,
	});

	expect(result.isSubset).toBe(expected);

	if (expected) {
		expect(result.errors).toEqual([]);
		return;
	}

	// Runtime validation runs against both sub and sup (same schema here),
	// so we expect errors prefixed with $sub and $sup.
	expect(result.errors.length).toBeGreaterThan(0);
	expect(result.errors[0]).toEqual({
		key: "$sub",
		expected: `format: ${format}`,
		received: typeof value === "string" ? value : JSON.stringify(value),
	});
}

// ─────────────────────────────────────────────────────────────────────────────
//  Enhancement 4 — format: semantic validation via class-validator
// ─────────────────────────────────────────────────────────────────────────────

describe("Enhancement 4 — format validation", () => {
	// ── 4.3 / 4.4 — Integration evaluateCondition / evaluateNot ───────────
	// (already covered in Enhancements 1 and 2 above)

	// ── 4.5 — Format-vs-format conflict in the merge engine ────────────────

	describe("4.5 — hasFormatConflict", () => {
		test("Test E.1: format ⊆ type → true (non-regression, handled natively)", () => {
			const sub: JSONSchema7 = { type: "string", format: "email" };
			const sup: JSONSchema7 = { type: "string" };
			expect(checker.isSubset(sub, sup)).toBe(true);
		});

		test("Test E.2: type ⊄ format → false (non-regression, handled natively)", () => {
			const sub: JSONSchema7 = { type: "string" };
			const sup: JSONSchema7 = { type: "string", format: "email" };
			expect(checker.isSubset(sub, sup)).toBe(false);
		});

		test("Test E.3: identical format → true (non-regression)", () => {
			const sub: JSONSchema7 = { type: "string", format: "uuid" };
			const sup: JSONSchema7 = { type: "string", format: "uuid" };
			expect(checker.isSubset(sub, sup)).toBe(true);
		});

		test("Test E.4: incompatible formats (email ∩ ipv4) → merge null", () => {
			const sub: JSONSchema7 = { type: "string", format: "email" };
			const sup: JSONSchema7 = { type: "string", format: "ipv4" };
			const result = checker.intersect(sub, sup);
			expect(result).toBeNull();
			expect(checker.isSubset(sub, sup)).toBe(false);
		});

		test("Test E.5: format with hierarchy (email ⊆ idn-email) → true", () => {
			const sub: JSONSchema7 = { type: "string", format: "email" };
			const sup: JSONSchema7 = { type: "string", format: "idn-email" };
			// email ⊆ idn-email → no format conflict
			expect(checker.isSubset(sub, sup)).toBe(true);
		});

		test("hostname ⊆ idn-hostname (hierarchy)", () => {
			const sub: JSONSchema7 = { type: "string", format: "hostname" };
			const sup: JSONSchema7 = { type: "string", format: "idn-hostname" };
			expect(checker.isSubset(sub, sup)).toBe(true);
		});

		test("uri ⊆ iri (hierarchy)", () => {
			const sub: JSONSchema7 = { type: "string", format: "uri" };
			const sup: JSONSchema7 = { type: "string", format: "iri" };
			expect(checker.isSubset(sub, sup)).toBe(true);
		});

		test("uri-reference ⊆ iri-reference (hierarchy)", () => {
			const sub: JSONSchema7 = { type: "string", format: "uri-reference" };
			const sup: JSONSchema7 = { type: "string", format: "iri-reference" };
			expect(checker.isSubset(sub, sup)).toBe(true);
		});

		test("idn-email ⊄ email (inverse of hierarchy)", () => {
			const sub: JSONSchema7 = { type: "string", format: "idn-email" };
			const sup: JSONSchema7 = { type: "string", format: "email" };
			// idn-email is NOT a subset of email (it's the inverse)
			// But the intersection idn-email ∩ email = email (the most restrictive)
			// so the merge does not return null — it returns a result with format email.
			// However, isSubset is false because merged ≠ sub.
			expect(checker.isSubset(sub, sup)).toBe(false);
		});

		test("different formats without relation → merge null", () => {
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

		test("same format → merge preserves the format", () => {
			const result = checker.intersect(
				{ type: "string", format: "email" },
				{ type: "string", format: "email" },
			) as JSONSchema7;
			expect(result).not.toBeNull();
			expect(result.format).toBe("email");
		});

		test("single format → merge preserves the format (no conflict)", () => {
			const result = checker.intersect(
				{ type: "string", format: "email" },
				{ type: "string", minLength: 5 },
			) as JSONSchema7;
			expect(result).not.toBeNull();
			expect(result.format).toBe("email");
		});

		test("format conflict in nested properties → merge null", () => {
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

		test("format conflict in items → merge null", () => {
			const result = checker.intersect(
				{ type: "array", items: { type: "string", format: "email" } },
				{ type: "array", items: { type: "string", format: "uuid" } },
			);
			expect(result).toBeNull();
		});
	});
});

describe("format — runtime validation for every supported format", () => {
	test("date-time runtime validation", () => {
		expectRuntimeFormatResult("date-time", "2024-01-15T10:30:00Z", true);
		expectRuntimeFormatResult("date-time", "not-a-date-time", false);
	});

	test("date runtime validation", () => {
		expectRuntimeFormatResult("date", "2024-01-15", true);
		expectRuntimeFormatResult("date", "2024-02-30", false);
	});

	test("time runtime validation", () => {
		expectRuntimeFormatResult("time", "10:30:00Z", true);
		expectRuntimeFormatResult("time", "not-a-time", false);
	});

	test("email runtime validation", () => {
		expectRuntimeFormatResult("email", "test@example.com", true);
		expectRuntimeFormatResult("email", "not-an-email", false);
	});

	test("idn-email runtime validation (AJV unsupported — graceful pass)", () => {
		// AJV does not natively validate idn-email; it silently ignores the format.
		// Valid values still pass, invalid values are NOT caught at runtime.
		expectRuntimeFormatResult("idn-email", "test@example.com", true);
		expectRuntimeFormatResult("idn-email", "not-an-email", true); // AJV ignores unknown format
	});

	test("hostname runtime validation", () => {
		expectRuntimeFormatResult("hostname", "example.com", true);
		expectRuntimeFormatResult("hostname", "bad host name", false);
	});

	test("idn-hostname runtime validation (AJV unsupported — graceful pass)", () => {
		// AJV does not natively validate idn-hostname; it silently ignores the format.
		expectRuntimeFormatResult("idn-hostname", "example.com", true);
		expectRuntimeFormatResult("idn-hostname", "bad host name", true); // AJV ignores unknown format
	});

	test("ipv4 runtime validation", () => {
		expectRuntimeFormatResult("ipv4", "192.168.1.1", true);
		expectRuntimeFormatResult("ipv4", "999.999.999.999", false);
	});

	test("ipv6 runtime validation", () => {
		expectRuntimeFormatResult("ipv6", "2001:db8::1", true);
		expectRuntimeFormatResult("ipv6", "not-an-ipv6", false);
	});

	test("uri runtime validation", () => {
		expectRuntimeFormatResult("uri", "https://example.com/path", true);
		expectRuntimeFormatResult("uri", "/relative/path", false);
	});

	test("uri-reference runtime validation", () => {
		expectRuntimeFormatResult(
			"uri-reference",
			"https://example.com/path",
			true,
		);
		expectRuntimeFormatResult("uri-reference", "not a uri reference", false);
	});

	test("iri runtime validation (AJV unsupported — graceful pass)", () => {
		// AJV does not natively validate iri; it silently ignores the format.
		expectRuntimeFormatResult("iri", "https://example.com/path", true);
		expectRuntimeFormatResult("iri", "/relative/path", true); // AJV ignores unknown format
	});

	test("iri-reference runtime validation (AJV unsupported — graceful pass)", () => {
		// AJV does not natively validate iri-reference; it silently ignores the format.
		expectRuntimeFormatResult(
			"iri-reference",
			"https://example.com/path",
			true,
		);
		expectRuntimeFormatResult("iri-reference", "not a iri reference", true); // AJV ignores unknown format
	});

	test("uri-template runtime validation", () => {
		expectRuntimeFormatResult(
			"uri-template",
			"https://example.com/{user}/orders{?id}",
			true,
		);
		expectRuntimeFormatResult(
			"uri-template",
			"https://example.com/{user",
			false,
		);
	});

	test("uuid runtime validation", () => {
		expectRuntimeFormatResult(
			"uuid",
			"123e4567-e89b-12d3-a456-426614174000",
			true,
		);
		expectRuntimeFormatResult("uuid", "not-a-uuid", false);
	});

	test("json-pointer runtime validation", () => {
		expectRuntimeFormatResult("json-pointer", "/items/0/name", true);
		expectRuntimeFormatResult("json-pointer", "items/0/name", false);
	});

	test("relative-json-pointer runtime validation", () => {
		expectRuntimeFormatResult("relative-json-pointer", "0#", true);
		expectRuntimeFormatResult("relative-json-pointer", "#", false);
	});

	test("regex runtime validation", () => {
		expectRuntimeFormatResult("regex", "^[a-z]+$", true);
		expectRuntimeFormatResult("regex", "[", false);
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
