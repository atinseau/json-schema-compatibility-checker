import {
	isEmail,
	isFQDN,
	isIP,
	isISO8601,
	isURL,
	isUUID,
} from "class-validator";

// ─── Format Validator ─────────────────────────────────────────────────────────
//
// Validates values against JSON Schema Draft-07 formats using
// utility functions from `class-validator`.
//
// ⚠️  This module does NOT handle the format ⊆ type relationship.
// That relationship is already correctly handled by the merge approach:
//   - { format: "email" } ⊆ { type: "string" } → true (merge changes nothing)
//   - { type: "string" } ⊄ { format: "email" } → false (merge adds format)
//
// This module ONLY handles:
//   1. Runtime validation of a value against a format (evaluateCondition)
//   2. Compatibility between two different formats (format-vs-format)
//
// Exposes:
//   - `validateFormat(value, format)` → runtime value validation
//   - `isFormatSubset(sub, sup)` → static format-vs-format compatibility
//   - `isKnownFormat(format)` → checks whether the format is supported
//   - `FORMAT_SUPERSETS` → inclusion hierarchy between formats

// ─── Regex patterns ──────────────────────────────────────────────────────────

/** Regex for the `time` format (HH:MM:SS with optional offset) */
const TIME_REGEX = /^\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/;

/** Regex for the `date` format (strict YYYY-MM-DD) */
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/** Regex for the `json-pointer` format (RFC 6901) */
const JSON_POINTER_REGEX = /^(\/([^~/]|~[01])*)*$/;

/** Regex for the `relative-json-pointer` format (Draft-07 extension) */
const RELATIVE_JSON_POINTER_REGEX = /^\d+(#|(\/([^~/]|~[01])*)*)$/;

/** Regex for the `uri-template` format (RFC 6570 — basic validation) */
const _URI_TEMPLATE_REGEX = /\{[^}]+\}/;

// ─── Known formats ──────────────────────────────────────────────────────────

/** Formats recognized by the validator */
export const KNOWN_FORMATS: ReadonlySet<string> = new Set([
	"date-time",
	"date",
	"time",
	"email",
	"idn-email",
	"hostname",
	"idn-hostname",
	"ipv4",
	"ipv6",
	"uri",
	"uri-reference",
	"iri",
	"iri-reference",
	"uri-template",
	"uuid",
	"json-pointer",
	"relative-json-pointer",
	"regex",
]);

// ─── Format hierarchy ────────────────────────────────────────────────────────

/**
 * Inclusion hierarchy BETWEEN FORMATS (not format-vs-type).
 *
 * `FORMAT_SUPERSETS[format]` = list of formats that are supersets
 * of `format` (i.e., every value valid for `format` is also valid
 * for each of the supersets).
 *
 * This hierarchy concerns ONLY format-vs-format comparisons.
 * The format ⊆ type relationship (e.g. email ⊆ string) is natively handled
 * by the merge engine and does not need to be modeled here.
 *
 * In practice, most formats are **incomparable** (no inclusion relationship).
 * Only identity (same format) and the few relationships below are guaranteed.
 */
export const FORMAT_SUPERSETS: Record<string, string[]> = {
	email: ["idn-email"], // email ⊆ idn-email (every ASCII email is a valid idn-email)
	hostname: ["idn-hostname"], // hostname ⊆ idn-hostname
	uri: ["iri"], // uri ⊆ iri (every URI is a valid IRI)
	"uri-reference": ["iri-reference"], // uri-reference ⊆ iri-reference
};

// ─── Format validators (internal) ───────────────────────────────────────────

/**
 * Internal map of validation functions by format.
 *
 * Each entry maps a Draft-07 format to a function that takes
 * a `string` value and returns `boolean`.
 *
 * Uses standalone functions from `class-validator` when available,
 * otherwise regex or heuristics.
 */
const FORMAT_VALIDATORS: Record<string, (value: string) => boolean> = {
	/** ISO 8601 date-time (ex: "2023-01-15T10:30:00Z") */
	"date-time": (value: string): boolean => {
		return isISO8601(value, { strict: true });
	},

	/** Full date (e.g. "2023-01-15") */
	date: (value: string): boolean => {
		if (!DATE_REGEX.test(value)) return false;
		// Verify that the date is valid (no 2023-02-30)
		const d = new Date(`${value}T00:00:00Z`);
		return !Number.isNaN(d.getTime()) && value === d.toISOString().slice(0, 10);
	},

	/** Full time (e.g. "10:30:00") */
	time: (value: string): boolean => {
		return TIME_REGEX.test(value);
	},

	/** Email address (RFC 5321) */
	email: (value: string): boolean => {
		return isEmail(value);
	},

	/** Internationalized email address (approximation via isEmail) */
	"idn-email": (value: string): boolean => {
		return isEmail(value);
	},

	/** Hostname (RFC 1123) */
	hostname: (value: string): boolean => {
		return isFQDN(value, { require_tld: false });
	},

	/** Internationalized hostname (approximation via isFQDN) */
	"idn-hostname": (value: string): boolean => {
		return isFQDN(value, { require_tld: false });
	},

	/** IPv4 address (e.g. "192.168.1.1") */
	ipv4: (value: string): boolean => {
		return isIP(value, 4);
	},

	/** IPv6 address (e.g. "::1") */
	ipv6: (value: string): boolean => {
		return isIP(value, 6);
	},

	/** Absolute URI (RFC 3986) */
	uri: (value: string): boolean => {
		return isURL(value, { require_protocol: true });
	},

	/** URI reference (absolute or relative — approximation via isURL) */
	"uri-reference": (value: string): boolean => {
		// A uri-reference can be relative, isURL is an approximation
		return isURL(value, { require_protocol: false });
	},

	/** IRI (RFC 3987 — approximation via isURL) */
	iri: (value: string): boolean => {
		return isURL(value, { require_protocol: true });
	},

	/** IRI reference (approximation via isURL) */
	"iri-reference": (value: string): boolean => {
		return isURL(value, { require_protocol: false });
	},

	/** URI template (RFC 6570 — basic validation) */
	"uri-template": (value: string): boolean => {
		// A valid uri-template can contain expressions within braces
		// or be a simple URI without template expressions.
		// We just verify that the braces are well-formed.
		let inBrace = false;
		for (const ch of value) {
			if (ch === "{") {
				if (inBrace) return false; // Nested braces
				inBrace = true;
			} else if (ch === "}") {
				if (!inBrace) return false; // Closing brace without opening
				inBrace = false;
			}
		}
		return !inBrace; // No unclosed brace
	},

	/** UUID (RFC 4122) */
	uuid: (value: string): boolean => {
		return isUUID(value);
	},

	/** JSON Pointer (RFC 6901) */
	"json-pointer": (value: string): boolean => {
		// Empty string is a valid json-pointer (points to the root)
		if (value === "") return true;
		return JSON_POINTER_REGEX.test(value);
	},

	/** Relative JSON Pointer (extension Draft-07) */
	"relative-json-pointer": (value: string): boolean => {
		return RELATIVE_JSON_POINTER_REGEX.test(value);
	},

	/** ECMA-262 regular expression */
	regex: (value: string): boolean => {
		try {
			new RegExp(value);
			return true;
		} catch {
			return false;
		}
	},
};

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Checks whether the format is known/supported.
 *
 * @param format  The format name to check
 * @returns       `true` if the format is in the list of recognized formats
 */
export function isKnownFormat(format: string): boolean {
	return KNOWN_FORMATS.has(format);
}

/**
 * Validates a value against a JSON Schema Draft-07 format.
 *
 * Returns `true` if the value is valid for the format,
 * `false` if it is not, `null` if the format is unknown.
 *
 * Only validates strings — for non-strings, returns `true`
 * (format only applies to strings in Draft-07).
 *
 * @param value   The value to validate
 * @param format  The JSON Schema Draft-07 format to check
 * @returns       `true` if valid, `false` if invalid, `null` if format unknown
 *
 * @example
 * ```ts
 * validateFormat("test@example.com", "email");  // true
 * validateFormat("not-an-email", "email");       // false
 * validateFormat(42, "email");                   // true (non-string → skip)
 * validateFormat("foo", "unknown-format");       // null (unknown format)
 * ```
 */
export function validateFormat(value: unknown, format: string): boolean | null {
	// Format only applies to strings in Draft-07
	if (typeof value !== "string") return true;

	const validator = FORMAT_VALIDATORS[format];
	if (!validator) return null; // Unknown format → indeterminate

	return validator(value);
}

/**
 * Checks whether the format `sub` is a subset of the format `sup`.
 *
 * ⚠️  This function ONLY compares two formats against each other.
 * It does NOT handle the format ⊆ type relationship (e.g. email ⊆ string),
 * which is already correctly handled by the merge engine.
 *
 * `sub ⊆ sup` means: every value valid for `sub` is also valid for `sup`.
 *
 * Returns `true` if `sub ⊆ sup`, `false` if incompatible, `null` if indeterminate.
 *
 * Cases handled:
 *   - Identity: `sub === sup` → `true`
 *   - Hierarchy: `sup` is in `FORMAT_SUPERSETS[sub]` → `true`
 *   - Reverse hierarchy: `sub` is in `FORMAT_SUPERSETS[sup]` → `null`
 *     (the subset is a superset of the superset → indeterminate, not a conflict
 *     because some values valid for sub could also be valid for sup)
 *   - Different formats with no known relationship → `null` (indeterminate)
 *
 * @param subFormat  The format of the sub schema
 * @param supFormat  The format of the sup schema
 * @returns          `true` if sub ⊆ sup, `null` if indeterminate
 *
 * @example
 * ```ts
 * isFormatSubset("email", "email");       // true (identity)
 * isFormatSubset("email", "idn-email");   // true (email ⊆ idn-email)
 * isFormatSubset("email", "ipv4");        // null (incomparable)
 * isFormatSubset("idn-email", "email");   // null (superset, not subset)
 * ```
 */
export function isFormatSubset(
	subFormat: string,
	supFormat: string,
): boolean | null {
	// Identity: same format → always a subset
	if (subFormat === supFormat) return true;

	// Hierarchy: check whether sup is a known superset of sub
	const supersets = FORMAT_SUPERSETS[subFormat];
	if (supersets?.includes(supFormat)) {
		return true;
	}

	// Different formats with no known relationship → indeterminate
	// We do NOT return false here because we cannot assert incompatibility
	// between two arbitrary formats without knowing them perfectly.
	// The merge engine (via hasFormatConflict) handles conflict detection
	// when both schemas have a format and no known relationship exists.
	return null;
}
