import type { JSONSchema7Definition } from "json-schema";
import type { Constraint } from "./types.ts";

// ─── Shared Utilities ────────────────────────────────────────────────────────
//
// Native utility functions shared across all modules.
// Centralized here to avoid duplication and allow V8
// to optimize a single instance of each hot-path function.

/**
 * Checks whether a value is a plain object (not null, not an array).
 */
export function isPlainObj(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Checks whether an object has an own property.
 */
export function hasOwn(obj: object, key: string): boolean {
	return Object.hasOwn(obj, key);
}

/**
 * Deep equality comparison between two values.
 *
 * Optimizations:
 *   - Reference equality short-circuit (a === b)
 *   - Length checks before iteration (arrays and objects)
 *   - No support for Date, RegExp, Map, Set (not needed for JSON Schema)
 */
export function deepEqual(a: unknown, b: unknown): boolean {
	if (a === b) return true;
	if (a === null || b === null) return false;
	if (typeof a !== typeof b) return false;

	if (typeof a === "object") {
		if (Array.isArray(a)) {
			if (!Array.isArray(b)) return false;
			const len = a.length;
			if (len !== b.length) return false;
			for (let i = 0; i < len; i++) {
				if (!deepEqual(a[i], b[i])) return false;
			}
			return true;
		}
		if (Array.isArray(b)) return false;

		const aObj = a as Record<string, unknown>;
		const bObj = b as Record<string, unknown>;
		const aKeys = Object.keys(aObj);
		const bKeys = Object.keys(bObj);
		if (aKeys.length !== bKeys.length) return false;
		for (const key of aKeys) {
			if (!(key in bObj) || !deepEqual(aObj[key], bObj[key])) return false;
		}
		return true;
	}

	return false;
}

/**
 * Creates a copy of an object without the specified keys.
 *
 * Optimized for the common case (1-2 keys to omit):
 *   - Uses a Set only if > 2 keys
 *   - Iterates over the source object only once
 *   - Returns the original if no key to omit is present in the object
 */
export function omitKeys<T extends Record<string, unknown>>(
	obj: T,
	keysToOmit: string[],
): T {
	// Fast path: check if any key to omit actually exists in the object
	if (keysToOmit.length <= 2) {
		const k0 = keysToOmit[0];
		const k1 = keysToOmit[1];
		const has0 = k0 !== undefined && k0 in obj;
		const has1 = k1 !== undefined && k1 in obj;
		if (!has0 && !has1) return obj;

		const result: Record<string, unknown> = {};
		for (const key of Object.keys(obj)) {
			if (key !== k0 && key !== k1) {
				result[key] = obj[key];
			}
		}
		return result as T;
	}

	const omitSet = new Set(keysToOmit);

	// Check if any key to omit exists
	let hasAny = false;
	for (const key of keysToOmit) {
		if (key in obj) {
			hasAny = true;
			break;
		}
	}
	if (!hasAny) return obj;

	const result: Record<string, unknown> = {};
	for (const key of Object.keys(obj)) {
		if (!omitSet.has(key)) {
			result[key] = obj[key];
		}
	}
	return result as T;
}

/**
 * Merges two string arrays while eliminating duplicates.
 * Returns an array with the unique elements from both sources.
 *
 * Optimized with fast paths for common cases:
 *   - If b is empty → returns a directly
 *   - If a is empty → returns b directly
 *   - For small arrays (≤ 8 total elements), uses a loop with
 *     includes instead of creating a Set
 */
export function unionStrings(a: string[], b: string[]): string[] {
	const aLen = a.length;
	const bLen = b.length;

	// Fast paths for empty arrays
	if (bLen === 0) return a;
	if (aLen === 0) return b;

	// Fast path for small arrays: avoid Set allocation overhead
	if (aLen + bLen <= 8) {
		const result = a.slice();
		for (let i = 0; i < bLen; i++) {
			const item = b[i];
			if (item !== undefined && !result.includes(item)) {
				result.push(item);
			}
		}
		// If nothing was added from b (all items already in a), return a
		return result.length === aLen ? a : result;
	}

	// General case: use Set for larger arrays
	const set = new Set(a);
	const initialSize = set.size;
	for (let i = 0; i < bLen; i++) {
		const item = b[i];
		if (item !== undefined) set.add(item);
	}

	// If nothing new was added, return a directly
	if (set.size === initialSize && initialSize === aLen) return a;

	return Array.from(set);
}

/**
 * Checks structural equality between two JSONSchema7Definition values.
 * Typed wrapper around deepEqual for schemas.
 */
export function schemaDeepEqual(
	a: JSONSchema7Definition,
	b: JSONSchema7Definition,
): boolean {
	return deepEqual(a, b);
}

/**
 * All JSON Schema Draft 7 keywords that have semantic (validation) impact.
 * Any key NOT in this set is considered non-semantic (metadata, extensions)
 * and should be ignored during subset comparison.
 */
const SEMANTIC_KEYWORDS = new Set([
	// validation
	"type",
	"enum",
	"const",
	// numeric
	"multipleOf",
	"maximum",
	"exclusiveMaximum",
	"minimum",
	"exclusiveMinimum",
	// string
	"maxLength",
	"minLength",
	"pattern",
	"format",
	// array
	"items",
	"additionalItems",
	"maxItems",
	"minItems",
	"uniqueItems",
	"contains",
	// object
	"maxProperties",
	"minProperties",
	"required",
	"properties",
	"patternProperties",
	"additionalProperties",
	"dependencies",
	"propertyNames",
	// conditionals
	"if",
	"then",
	"else",
	// composition
	"allOf",
	"anyOf",
	"oneOf",
	"not",
	// references
	"$ref",
	// custom constraints (used by this library)
	"constraints",
]);

/** Keywords whose value is a Record<string, JSONSchema7Definition> (property maps). */
const SCHEMA_MAP_KEYWORDS = new Set([
	"properties",
	"patternProperties",
	"dependencies",
]);

/** Keywords whose value is a single sub-schema. */
const SINGLE_SCHEMA_KEYWORDS = new Set([
	"items",
	"additionalItems",
	"additionalProperties",
	"contains",
	"propertyNames",
	"not",
	"if",
	"then",
	"else",
]);

/** Keywords whose value is an array of sub-schemas. */
const ARRAY_SCHEMA_KEYWORDS = new Set(["allOf", "anyOf", "oneOf"]);

/**
 * Schema-aware deep equality that ignores non-semantic keywords
 * (metadata like `title`, `description`, `default`, `examples`,
 * and extension keywords like `x-tags`, `tags`, etc.).
 *
 * Unlike a naive recursive strip, this function understands JSON Schema
 * structure: it only filters keys at schema level, and correctly recurses
 * into property maps (where keys are user-defined property names, not
 * schema keywords) and sub-schema keywords.
 */
export function semanticDeepEqual(a: unknown, b: unknown): boolean {
	// Fast path: structurally identical
	if (a === b) return true;
	if (a === null || b === null) return false;
	if (typeof a !== typeof b) return false;

	if (typeof a === "object") {
		if (Array.isArray(a)) {
			if (!Array.isArray(b)) return false;
			if (a.length !== b.length) return false;
			for (let i = 0; i < a.length; i++) {
				if (!semanticDeepEqual(a[i], b[i])) return false;
			}
			return true;
		}
		if (Array.isArray(b)) return false;

		const aObj = a as Record<string, unknown>;
		const bObj = b as Record<string, unknown>;

		// Collect only semantic keys from each side
		const aKeys = Object.keys(aObj).filter((k) => SEMANTIC_KEYWORDS.has(k));
		const bKeys = Object.keys(bObj).filter((k) => SEMANTIC_KEYWORDS.has(k));
		if (aKeys.length !== bKeys.length) return false;

		for (const key of aKeys) {
			if (!(key in bObj)) return false;

			const aVal = aObj[key];
			const bVal = bObj[key];

			if (SCHEMA_MAP_KEYWORDS.has(key)) {
				// Property maps: keys are user-defined names, values are sub-schemas
				if (!schemaMapEqual(aVal, bVal)) return false;
			} else if (SINGLE_SCHEMA_KEYWORDS.has(key)) {
				// Single sub-schema: recurse with semantic comparison
				if (!semanticDeepEqual(aVal, bVal)) return false;
			} else if (ARRAY_SCHEMA_KEYWORDS.has(key)) {
				// Array of sub-schemas
				if (!Array.isArray(aVal) || !Array.isArray(bVal)) {
					if (!deepEqual(aVal, bVal)) return false;
				} else {
					if (aVal.length !== bVal.length) return false;
					for (let i = 0; i < aVal.length; i++) {
						if (!semanticDeepEqual(aVal[i], bVal[i])) return false;
					}
				}
			} else {
				// Leaf keywords (type, enum, const, minimum, etc.): plain deepEqual
				if (!deepEqual(aVal, bVal)) return false;
			}
		}
		return true;
	}

	return false;
}

/**
 * Compares two schema maps (like `properties`) where keys are user-defined
 * names and values are sub-schemas. Keys are compared literally (they are
 * NOT schema keywords), values are compared with `semanticDeepEqual`.
 */
function schemaMapEqual(a: unknown, b: unknown): boolean {
	if (!isPlainObj(a) || !isPlainObj(b)) return deepEqual(a, b);
	const aObj = a as Record<string, unknown>;
	const bObj = b as Record<string, unknown>;
	const aKeys = Object.keys(aObj);
	const bKeys = Object.keys(bObj);
	if (aKeys.length !== bKeys.length) return false;
	for (const key of aKeys) {
		if (!(key in bObj)) return false;
		if (!semanticDeepEqual(aObj[key], bObj[key])) return false;
	}
	return true;
}

// ─── Constraints Helpers ─────────────────────────────────────────────────────

/**
 * Normalizes a `Constraints` value (single or array) into an array.
 * Returns an empty array if the value is `undefined`.
 */
export function toConstraintArray(value: unknown): Constraint[] {
	if (value === undefined) return [];
	if (Array.isArray(value)) return value as Constraint[];
	return [value as Constraint];
}

/**
 * Merges two constraint lists by computing their **union**, deduplicated
 * by deep equality. Two constraints are considered identical if they are
 * deeply equal (same string, or same `{ name, params }` object).
 *
 * This is the correct operation for `allOf` / intersection semantics:
 * a value must satisfy ALL constraints from both schemas.
 *
 * @returns The merged array, or `undefined` if both inputs are empty/absent.
 */
export function mergeConstraints(
	a: unknown,
	b: unknown,
): Constraint[] | undefined {
	const aArr = toConstraintArray(a);
	const bArr = toConstraintArray(b);

	if (aArr.length === 0 && bArr.length === 0) return undefined;
	if (aArr.length === 0) return bArr.slice();
	if (bArr.length === 0) return aArr.slice();

	// Start from a copy of a, add items from b that are not already present
	const result: Constraint[] = aArr.slice();
	for (const bItem of bArr) {
		const alreadyPresent = result.some((existing) =>
			deepEqual(existing, bItem),
		);
		if (!alreadyPresent) {
			result.push(bItem);
		}
	}
	return result;
}
