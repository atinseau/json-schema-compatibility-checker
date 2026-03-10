import type { JSONSchema7, JSONSchema7Definition } from "json-schema";
import { deepEqual, hasOwn, isPlainObj } from "./utils.ts";

// ─── Schema Normalizer ───────────────────────────────────────────────────────
//
// Pure functions to normalize a JSON Schema:
//   - Infer `type` from `const` or `enum`
//   - Recurse into all sub-structures (properties, items, anyOf, etc.)
//   - Resolve double negation `not.not` → flatten to direct content
//   - Recurse into `patternProperties` (Point 2)
//   - Recurse into `dependencies` schema form (Point 3)
//
// Optimizations:
//   - WeakMap cache to avoid re-normalizing the same object
//   - Lazy copy-on-write: only creates a copy when mutations are needed
//   - Returns the original if nothing changed (avoids allocations)

// ─── Normalization Cache ─────────────────────────────────────────────────────

/**
 * WeakMap cache for normalization results.
 * Avoids re-normalizing the same schema object multiple times.
 * WeakMap allows the GC to collect schemas that are no longer referenced.
 */
const normalizeCache = new WeakMap<object, JSONSchema7Definition>();

// ─── Type inference ──────────────────────────────────────────────────────────

/**
 * Infers the JSON Schema type from a JavaScript value.
 */
export function inferType(value: unknown): string | undefined {
	if (value === null) return "null";
	switch (typeof value) {
		case "string":
			return "string";
		case "number":
			return Number.isInteger(value) ? "integer" : "number";
		case "boolean":
			return "boolean";
		case "object":
			return Array.isArray(value) ? "array" : "object";
		default:
			return undefined;
	}
}

// ─── Sub-schema keywords ─────────────────────────────────────────────────────

/** Keywords containing a single sub-schema */
const SINGLE_SCHEMA_KEYWORDS = [
	"additionalProperties",
	"additionalItems",
	"contains",
	"propertyNames",
	"not",
	"if",
	"then",
	"else",
] as const;

/**
 * Checks whether a schema contains only the `not` keyword (and no other
 * significant keyword). Used for double negation resolution.
 *
 * A "pure not" schema has the form `{ not: X }` without any other constraint.
 * In that case, `{ not: { not: Y } }` ≡ `Y`.
 *
 * Metadata keywords (`$id`, `$schema`, `$comment`, `title`, `description`,
 * `default`, `examples`, `definitions`, `$defs`) are NOT considered
 * significant for this detection.
 */
const METADATA_KEYWORDS = new Set([
	"$id",
	"$schema",
	"$comment",
	"title",
	"description",
	"default",
	"examples",
	"definitions",
	"$defs",
]);

/**
 * Checks whether a schema object contains only the `not` keyword
 * (plus optionally non-significant metadata).
 */
function isPureNotSchema(schema: JSONSchema7): boolean {
	const schemaKeys = Object.keys(schema);
	return schemaKeys.every((k) => k === "not" || METADATA_KEYWORDS.has(k));
}

/** Keywords containing an array of sub-schemas */
const ARRAY_SCHEMA_KEYWORDS = ["anyOf", "oneOf", "allOf"] as const;

/**
 * Keywords containing a Record<string, JSONSchema7Definition>
 * (each value is a sub-schema to normalize recursively).
 */
const PROPERTIES_LIKE_KEYWORDS = ["properties", "patternProperties"] as const;

// ─── Internal helpers ────────────────────────────────────────────────────────

/**
 * Normalizes a `Record<string, JSONSchema7Definition>` by applying
 * `normalize` to each value.
 * Returns the original object if nothing changed (avoids allocations).
 */
function normalizePropertiesMap(
	props: Record<string, JSONSchema7Definition>,
): Record<string, JSONSchema7Definition> {
	const keys = Object.keys(props);
	let changed = false;

	// First pass: detect if anything changes (sub-schemas get cached)
	for (let i = 0; i < keys.length; i++) {
		const key = keys[i];
		if (key === undefined) continue;
		const original = props[key];
		const normalized = normalize(original as JSONSchema7Definition);
		if (normalized !== original) {
			changed = true;
			break;
		}
	}

	if (!changed) return props;

	// Build result only when something changed (sub normalize calls hit cache)
	const result: Record<string, JSONSchema7Definition> = {};
	for (let i = 0; i < keys.length; i++) {
		const key = keys[i];
		if (key === undefined) continue;
		result[key] = normalize(props[key] as JSONSchema7Definition);
	}

	return result;
}

/**
 * Infers `type` from `const` if absent.
 * Returns the inferred type or undefined if not applicable.
 */
function inferTypeFromConst(
	schema: JSONSchema7,
): JSONSchema7["type"] | undefined {
	if (!hasOwn(schema, "const") || schema.type !== undefined) return undefined;
	const t = inferType(schema.const);
	return t ? (t as JSONSchema7["type"]) : undefined;
}

/**
 * Infers `type` from `enum` if absent.
 * Returns the inferred type (single or array) or undefined if not applicable.
 */
function inferTypeFromEnum(
	schema: JSONSchema7,
): JSONSchema7["type"] | undefined {
	if (!Array.isArray(schema.enum) || schema.type !== undefined)
		return undefined;

	const typesSet = new Set<string>();
	for (const v of schema.enum) {
		const t = inferType(v);
		if (t) typesSet.add(t);
	}

	const count = typesSet.size;
	if (count === 0) return undefined;

	const types = Array.from(typesSet);
	if (count === 1) return types[0] as JSONSchema7["type"];
	return types as JSONSchema7["type"];
}

// ─── Normalization ───────────────────────────────────────────────────────────

/**
 * Normalizes a schema: infers `type` from `const`/`enum`,
 * and recursively normalizes all sub-schemas.
 *
 * Recurses into:
 *   - `properties` and `patternProperties` (Point 2)
 *   - `dependencies` schema form (Point 3) — array values (form 1)
 *     are left unchanged
 *   - `items` (single or tuple)
 *   - Single-schema keywords (`additionalProperties`, `not`, `if`, etc.)
 *   - Array-of-schema keywords (`anyOf`, `oneOf`, `allOf`)
 *
 * Optimizations:
 *   - WeakMap cache: returns the cached result in O(1)
 *   - Lazy copy-on-write: only creates a shallow copy when the first
 *     mutation is needed, via `ensureCopy()`
 *   - Sub-structures are only replaced if actually changed
 */
export function normalize(def: JSONSchema7Definition): JSONSchema7Definition {
	if (typeof def === "boolean") return def;

	// ── Cache lookup (O(1) fast path) ──
	const cached = normalizeCache.get(def);
	if (cached !== undefined) return cached;

	// ── Lazy copy-on-write ──
	// We delay creating a shallow copy until the first actual mutation.
	// `schema` starts as `def` and only becomes a copy when `ensureCopy()` is called.
	let schema = def as JSONSchema7 & Record<string, unknown>;
	let copied = false;

	function ensureCopy(): JSONSchema7 & Record<string, unknown> {
		if (!copied) {
			schema = { ...(def as JSONSchema7) } as JSONSchema7 &
				Record<string, unknown>;
			copied = true;
		}
		return schema;
	}

	// ── Infer type from const ──
	const typeFromConst = inferTypeFromConst(schema);
	if (typeFromConst) {
		ensureCopy().type = typeFromConst;
	}

	// ── Infer type from enum ──
	const typeFromEnum = inferTypeFromEnum(schema);
	if (typeFromEnum) {
		ensureCopy().type = typeFromEnum;
	}

	// ── Convert single-element enum to const ──
	// Semantically, { enum: [X] } ≡ { const: X }.
	// This normalization ensures that structural comparison (isEqual) does not
	// produce false negatives when one schema uses enum and the other uses
	// const for the same value.
	if (
		Array.isArray(schema.enum) &&
		schema.enum.length === 1 &&
		!hasOwn(schema, "const")
	) {
		const s = ensureCopy();
		s.const = schema.enum[0];
		delete s.enum;
	}

	// ── Strip redundant enum when const is present ──
	// If `const: X` and `enum: [... X ...]` coexist, `const` is more
	// restrictive → `enum` is redundant. The merge engine can produce
	// this combination during the const ∩ enum intersection.
	if (hasOwn(schema, "const") && Array.isArray(schema.enum)) {
		if (schema.enum.some((v) => deepEqual(v, schema.const))) {
			delete ensureCopy().enum;
		}
	}

	// ── Strip constraints from the static path ──
	// The `constraints` keyword is a runtime-only concept: it represents
	// custom validators (e.g. "IsUuid", "NotFoundConstraint") that can only
	// be evaluated against concrete data. Including them in the normalized
	// schema would cause false negatives in the structural subset check
	// (e.g. `{ type: "string" }` would fail to be recognized as a subset of
	// `{ type: "string", constraints: ["X"] }` because the merge adds the
	// constraint to the result, making merged ≠ sub).
	//
	// Stripping here is safe: the runtime validation path
	// (`validateSchemaConstraints`) receives the original resolved/narrowed
	// schemas that have NOT been through `normalize()`, so constraints are
	// still available for runtime evaluation.
	if (hasOwn(schema, "constraints") && schema.constraints !== undefined) {
		const s = ensureCopy();
		delete s.constraints;
	}

	// ── Recurse into properties & patternProperties (Point 2) ──
	for (const keyword of PROPERTIES_LIKE_KEYWORDS) {
		const val = schema[keyword];
		if (isPlainObj(val)) {
			const normalized = normalizePropertiesMap(
				val as Record<string, JSONSchema7Definition>,
			);
			if (normalized !== val) {
				ensureCopy()[keyword] = normalized as JSONSchema7["properties"];
			}
		}
	}

	// ── Recurse into dependencies (Point 3) ──
	// `dependencies` can contain:
	//   - Form 1 (property deps): { foo: ["bar", "baz"] } → string array, skip
	//   - Form 2 (schema deps): { foo: { required: [...] } } → schema object, normalize
	if (isPlainObj(schema.dependencies)) {
		const deps = schema.dependencies as Record<
			string,
			JSONSchema7Definition | string[]
		>;
		const depsKeys = Object.keys(deps);
		let depsChanged = false;
		const newDeps: Record<string, JSONSchema7Definition | string[]> = {};

		for (let i = 0; i < depsKeys.length; i++) {
			const key = depsKeys[i];
			if (key === undefined) continue;
			const val = deps[key];
			if (val === undefined) continue;
			if (Array.isArray(val)) {
				// Form 1: string array → leave as-is
				newDeps[key] = val;
			} else if (isPlainObj(val)) {
				// Form 2: sub-schema → normalize recursively
				const normalized = normalize(val as JSONSchema7Definition);
				newDeps[key] = normalized;
				if (normalized !== val) depsChanged = true;
			} else {
				newDeps[key] = val as JSONSchema7Definition;
			}
		}

		if (depsChanged) {
			ensureCopy().dependencies = newDeps;
		}
	}

	// ── Recurse into items (tuple or single) ──
	if (schema.items) {
		if (Array.isArray(schema.items)) {
			// Tuple: normalize each element
			const items = schema.items as JSONSchema7Definition[];
			let itemsChanged = false;
			const newItems: JSONSchema7Definition[] = new Array(items.length);

			for (let i = 0; i < items.length; i++) {
				const original = items[i];
				if (original === undefined) continue;
				const normalized = normalize(original);
				newItems[i] = normalized;
				if (normalized !== original) itemsChanged = true;
			}

			if (itemsChanged) {
				ensureCopy().items = newItems;
			}
		} else if (isPlainObj(schema.items)) {
			// Single items schema
			const normalized = normalize(schema.items as JSONSchema7Definition);
			if (normalized !== schema.items) {
				ensureCopy().items = normalized;
			}
		}
	}

	// ── Recurse into single-schema keywords ──
	for (const key of SINGLE_SCHEMA_KEYWORDS) {
		const val = schema[key];
		if (val !== undefined && typeof val !== "boolean") {
			const normalized = normalize(val as JSONSchema7Definition);
			if (normalized !== val) {
				(ensureCopy() as Record<string, JSONSchema7Definition>)[key] =
					normalized;
			}
		}
	}

	// ── Resolve double negation not(not(X)) → X ──
	// After recursing into sub-schemas, `schema.not` is normalized.
	// If `schema.not` is an object that only contains `not` (a "pure not"),
	// then `{ ...rest, not: { not: X } }` ≡ `{ ...rest, ...X }`.
	//
	// Propositional logic: ¬¬P ≡ P
	//
	// We only resolve the "pure" case (schema.not has only `not` as a
	// significant key) to avoid false positives in complex cases.
	if (
		hasOwn(schema, "not") &&
		isPlainObj(schema.not) &&
		typeof schema.not !== "boolean"
	) {
		const notSchema = schema.not as JSONSchema7;
		if (
			hasOwn(notSchema, "not") &&
			isPureNotSchema(notSchema) &&
			isPlainObj(notSchema.not) &&
			typeof notSchema.not !== "boolean"
		) {
			// Extract the content of not.not and merge it into the rest of the schema
			const innerSchema = notSchema.not as JSONSchema7;
			const s = ensureCopy();
			// Remove `not` from the current schema
			delete s.not;
			// Merge the inner content into the current schema
			const innerKeys = Object.keys(innerSchema);
			for (let i = 0; i < innerKeys.length; i++) {
				const ik = innerKeys[i];
				if (ik === undefined) continue;
				(s as Record<string, unknown>)[ik] = (
					innerSchema as Record<string, unknown>
				)[ik];
			}
		}
	}

	// ── Recurse into array-of-schema keywords ──
	for (const key of ARRAY_SCHEMA_KEYWORDS) {
		const val = schema[key];
		if (Array.isArray(val)) {
			const arr = val as JSONSchema7Definition[];
			let arrChanged = false;
			const newArr: JSONSchema7Definition[] = new Array(arr.length);

			for (let i = 0; i < arr.length; i++) {
				const original = arr[i];
				if (original === undefined) continue;
				const normalized = normalize(original);
				newArr[i] = normalized;
				if (normalized !== original) arrChanged = true;
			}

			if (arrChanged) {
				ensureCopy()[key] = newArr;
			}
		}
	}

	// ── Determine result ──
	// If nothing changed (copied === false), return the original def.
	// Otherwise, return the mutated copy.
	const result = (copied ? schema : def) as JSONSchema7Definition;

	// ── Cache the result ──
	normalizeCache.set(def, result);

	return result;
}
