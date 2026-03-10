import {
	createComparator,
	createMerger,
	createShallowAllOfMerge,
} from "@x0k/json-schema-merge";
import {
	createDeduplicator,
	createIntersector,
} from "@x0k/json-schema-merge/lib/array";

import type {
	JSONSchema7,
	JSONSchema7Definition,
	JSONSchema7Type,
} from "json-schema";

import { isFormatSubset } from "./format-validator.ts";
import {
	deepEqual,
	hasOwn,
	isPlainObj,
	mergeConstraints,
	unionStrings,
} from "./utils.ts";

// ─── Merge Engine ────────────────────────────────────────────────────────────
//
// Wraps the `@x0k/json-schema-merge` library and exposes a simple API
// for merging and comparing JSON Schemas.
//
// Mathematical principle:
//   A ∩ B  =  allOf([A, B])  resolved via shallow merge
//   A ≡ B  ⟺  compare(A, B) === 0
//
// Pre-checks before merge:
//   - `hasDeepConstConflict`: detects `const`/`enum` conflicts
//   - `hasAdditionalPropertiesConflict`: detects `additionalProperties` conflicts
//   - `hasFormatConflict`: detects `format` conflicts between two schemas

// ─── Const conflict detection ────────────────────────────────────────────────

/**
 * Detects a `const` conflict between two schemas.
 *
 * Case 1 — const vs const: both schemas have a `const` with different
 *   values → empty intersection.
 *
 * Case 2 — const vs enum: one schema has `const`, the other has `enum`.
 *   If the `const` value is not in the `enum` → empty intersection.
 *
 * Uses `deepEqual` from `utils.ts` for deep comparison (objects, arrays).
 */
function hasConstConflict(
	a: JSONSchema7Definition,
	b: JSONSchema7Definition,
): boolean {
	if (typeof a === "boolean" || typeof b === "boolean") return false;

	const aHasConst = hasOwn(a, "const");
	const bHasConst = hasOwn(b, "const");
	const aConst = (a as Record<string, unknown>).const;
	const bConst = (b as Record<string, unknown>).const;
	const aEnum = a.enum as unknown[] | undefined;
	const bEnum = b.enum as unknown[] | undefined;

	// Case 1 — const vs const
	if (aHasConst && bHasConst) {
		return !deepEqual(aConst, bConst);
	}

	// Case 2 — const vs enum
	if (aHasConst && Array.isArray(bEnum)) {
		return !bEnum.some((v) => deepEqual(v, aConst));
	}
	if (bHasConst && Array.isArray(aEnum)) {
		return !aEnum.some((v) => deepEqual(v, bConst));
	}

	return false;
}

/** Keywords containing a single sub-schema to check recursively */
const SINGLE_SCHEMA_CONFLICT_KEYS = [
	"items",
	"additionalProperties",
	"contains",
	"propertyNames",
	"not",
] as const;

/** Keywords containing a Record<string, JSONSchema7Definition> */
const PROPERTIES_MAP_CONFLICT_KEYS = [
	"properties",
	"patternProperties",
] as const;

/**
 * Recursively detects `const` conflicts in sub-schemas.
 *
 * When the merge library performs a shallow merge, nested sub-schemas
 * can also have hidden `const` conflicts
 * (it uses `identity` for `const`).
 *
 * Recurses into:
 *   - `properties`, `patternProperties` (common keys)
 *   - `items` (single schema), tuple `items` (by index)
 *   - `additionalProperties`, `contains`, `propertyNames`, `not`
 */
function hasDeepConstConflict(
	a: JSONSchema7Definition,
	b: JSONSchema7Definition,
): boolean {
	if (hasConstConflict(a, b)) return true;

	if (typeof a === "boolean" || typeof b === "boolean") return false;

	// ── Single sub-schema keywords ──
	for (const key of SINGLE_SCHEMA_CONFLICT_KEYS) {
		const aVal = (a as Record<string, unknown>)[key] as
			| JSONSchema7Definition
			| undefined;
		const bVal = (b as Record<string, unknown>)[key] as
			| JSONSchema7Definition
			| undefined;
		if (
			isPlainObj(aVal) &&
			isPlainObj(bVal) &&
			hasDeepConstConflict(
				aVal as JSONSchema7Definition,
				bVal as JSONSchema7Definition,
			)
		) {
			return true;
		}
	}

	// ── Properties-like maps (properties, patternProperties) ──
	for (const key of PROPERTIES_MAP_CONFLICT_KEYS) {
		const aMap = (a as Record<string, unknown>)[key] as
			| Record<string, JSONSchema7Definition>
			| undefined;
		const bMap = (b as Record<string, unknown>)[key] as
			| Record<string, JSONSchema7Definition>
			| undefined;
		if (!isPlainObj(aMap) || !isPlainObj(bMap)) continue;
		const aMapSafe = aMap as Record<string, JSONSchema7Definition>;
		const bMapSafe = bMap as Record<string, JSONSchema7Definition>;
		for (const propKey of Object.keys(aMapSafe)) {
			const aVal = aMapSafe[propKey];
			const bVal = bMapSafe[propKey];
			if (
				aVal !== undefined &&
				bVal !== undefined &&
				hasOwn(bMapSafe, propKey) &&
				hasDeepConstConflict(aVal, bVal)
			) {
				return true;
			}
		}
	}

	// ── Tuple items (array of schemas, compared by index) ──
	if (Array.isArray(a.items) && Array.isArray(b.items)) {
		const aItems = a.items as JSONSchema7Definition[];
		const bItems = b.items as JSONSchema7Definition[];
		const len = Math.min(aItems.length, bItems.length);
		for (let i = 0; i < len; i++) {
			const aItem = aItems[i];
			const bItem = bItems[i];
			if (aItem === undefined || bItem === undefined) continue;
			if (hasDeepConstConflict(aItem, bItem)) {
				return true;
			}
		}
	}

	return false;
}

// ─── additionalProperties conflict detection ─────────────────────────────────

/**
 * Detects a conflict between `additionalProperties` and the extra
 * **required** properties of the other schema.
 *
 * ⚠️  This function is **ultra-conservative**: it only detects conflicts
 * where a property is simultaneously:
 *   - FORBIDDEN by `additionalProperties: false` on one side
 *   - REQUIRED (`required`) by the other side
 *   - ABSENT from `properties` on the restrictive side
 *   - AND the restrictive side ALSO has a `required` that makes the object non-empty
 *     (otherwise the library already handles the case by excluding extra properties)
 *
 * The merge library (`@x0k/json-schema-merge`) ALREADY correctly handles
 * the `additionalProperties: false` case with properties that are merely DEFINED
 * (not required) in the other schema — it excludes them from the result.
 * We therefore only detect `required` contradictions that are impossible to resolve.
 *
 * Cases handled:
 *   1. `a` has `additionalProperties: false` and `b` REQUIRES properties
 *      absent from `a.properties`, AND those properties are in `b.properties`
 *      → certain conflict (empty intersection because b requires, a forbids)
 *   2. Symmetric for `b.additionalProperties: false`
 *   3. `additionalProperties` as a schema → check type compatibility
 *      of extra REQUIRED properties only
 *   4. Recursion into common properties (sub-objects)
 *
 * ⚠️  Only checks keys from `properties`, not `patternProperties`
 * (too complex to resolve statically).
 *
 * Returns `true` if an obvious conflict is detected, `false` otherwise.
 * When in doubt → `false` (conservative, let the merge decide).
 */
function hasAdditionalPropertiesConflict(
	a: JSONSchema7Definition,
	b: JSONSchema7Definition,
): boolean {
	if (typeof a === "boolean" || typeof b === "boolean") return false;

	const aProps = isPlainObj(a.properties)
		? (a.properties as Record<string, JSONSchema7Definition>)
		: undefined;
	const bProps = isPlainObj(b.properties)
		? (b.properties as Record<string, JSONSchema7Definition>)
		: undefined;

	// If neither has properties, we cannot determine anything
	if (!aProps && !bProps) return false;

	const aKeys = aProps ? Object.keys(aProps) : [];
	const bKeys = bProps ? Object.keys(bProps) : [];
	const aRequired = Array.isArray(a.required) ? (a.required as string[]) : [];
	const bRequired = Array.isArray(b.required) ? (b.required as string[]) : [];

	// ── Check additionalProperties: false of a vs extra REQUIRED properties of b ──
	// Strict condition: b must DEFINE the property in b.properties AND
	// REQUIRE it in b.required, AND this property must be ABSENT from a.properties.
	// Additionally, a must itself have properties (otherwise we can't determine anything).
	if (a.additionalProperties === false && aProps && bProps) {
		const hasRequiredExtra = bRequired.some(
			(k) => !hasOwn(aProps, k) && hasOwn(bProps, k),
		);
		// Only detect the conflict if a also has a required that makes the object
		// structurally constrained (not a vague schema)
		if (hasRequiredExtra && aKeys.length > 0) return true;
	}

	// ── Check for additionalProperties as a schema ──
	// If a.additionalProperties is a schema with a type, and b REQUIRES
	// an extra property whose type is incompatible → conflict
	if (
		isPlainObj(a.additionalProperties) &&
		typeof a.additionalProperties !== "boolean" &&
		aProps &&
		bProps
	) {
		const addPropsSchema = a.additionalProperties as JSONSchema7;
		if (hasOwn(addPropsSchema, "type")) {
			const addPropsType = addPropsSchema.type;
			const hasTypeConflict = bRequired.some((k) => {
				if (hasOwn(aProps, k)) return false;
				if (!hasOwn(bProps, k)) return false;
				const bPropDef = bProps[k];
				if (typeof bPropDef === "boolean") return false;
				const bProp = bPropDef as JSONSchema7;
				if (!hasOwn(bProp, "type")) return false;
				if (
					typeof addPropsType === "string" &&
					typeof bProp.type === "string"
				) {
					return (
						addPropsType !== bProp.type &&
						!(addPropsType === "number" && bProp.type === "integer") &&
						!(addPropsType === "integer" && bProp.type === "number")
					);
				}
				return false;
			});
			if (hasTypeConflict) return true;
		}
	}

	// ── Symmetric check: additionalProperties of b vs extra REQUIRED properties of a ──
	if (b.additionalProperties === false && bProps && aProps) {
		const hasRequiredExtra = aRequired.some(
			(k) => !hasOwn(bProps, k) && hasOwn(aProps, k),
		);
		if (hasRequiredExtra && bKeys.length > 0) return true;
	}

	// Symmetric for additionalProperties as a schema
	if (
		isPlainObj(b.additionalProperties) &&
		typeof b.additionalProperties !== "boolean" &&
		bProps &&
		aProps
	) {
		const addPropsSchema = b.additionalProperties as JSONSchema7;
		if (hasOwn(addPropsSchema, "type")) {
			const addPropsType = addPropsSchema.type;
			const hasTypeConflict = aRequired.some((k) => {
				if (hasOwn(bProps, k)) return false;
				if (!hasOwn(aProps, k)) return false;
				const aPropDef = aProps[k];
				if (typeof aPropDef === "boolean") return false;
				const aProp = aPropDef as JSONSchema7;
				if (!hasOwn(aProp, "type")) return false;
				if (
					typeof addPropsType === "string" &&
					typeof aProp.type === "string"
				) {
					return (
						addPropsType !== aProp.type &&
						!(addPropsType === "number" && aProp.type === "integer") &&
						!(addPropsType === "integer" && aProp.type === "number")
					);
				}
				return false;
			});
			if (hasTypeConflict) return true;
		}
	}

	// ── Recursion into common properties ──
	// If both schemas have common properties that are objects,
	// recursively check additionalProperties conflicts
	if (aProps && bProps) {
		for (const k of aKeys) {
			if (!hasOwn(bProps, k)) continue;
			const aPropDef = aProps[k];
			const bPropDef = bProps[k];
			if (typeof aPropDef === "boolean" || typeof bPropDef === "boolean")
				continue;
			if (
				hasAdditionalPropertiesConflict(
					aPropDef as JSONSchema7Definition,
					bPropDef as JSONSchema7Definition,
				)
			) {
				return true;
			}
		}
	}

	return false;
}

// ─── Format conflict detection ───────────────────────────────────────────────

/**
 * Detects a format conflict between two schemas.
 *
 * ⚠️  Only triggers when BOTH schemas have a `format`.
 * If only one schema has a `format`, there is NO conflict — the merge
 * engine handles this case natively (the format is preserved in the intersection,
 * and the `merged ≡ sub` comparison correctly determines the ⊆ relation).
 *
 * Two schemas with different formats and no known inclusion relation
 * have an empty intersection (e.g., "email" ∩ "ipv4" = ∅).
 *
 * Uses `isFormatSubset` from `format-validator.ts` to check the hierarchy.
 *
 * Recurses into sub-schemas (`properties`, `items`, etc.) to detect
 * nested format conflicts.
 *
 * @returns `true` if a format conflict is detected, `false` otherwise
 */
function hasFormatConflict(
	a: JSONSchema7Definition,
	b: JSONSchema7Definition,
): boolean {
	if (typeof a === "boolean" || typeof b === "boolean") return false;

	// ── Only when BOTH have a format ──
	// If only one has a format → no conflict, the merge handles it natively
	if (hasOwn(a, "format") && hasOwn(b, "format")) {
		const aFormat = a.format as string;
		const bFormat = b.format as string;

		// Same format → no conflict
		if (aFormat !== bFormat) {
			// Check if one is a subset of the other via the hierarchy
			const subsetCheck = isFormatSubset(aFormat, bFormat);
			if (subsetCheck !== true) {
				const reverseCheck = isFormatSubset(bFormat, aFormat);
				if (reverseCheck !== true) {
					// Different formats with no known relation → conflict
					return true;
				}
			}
		}
	}

	// ── Recursion into sub-schemas ──
	// Check format conflicts in common properties
	if (isPlainObj(a.properties) && isPlainObj(b.properties)) {
		const aMap = a.properties as Record<string, JSONSchema7Definition>;
		const bMap = b.properties as Record<string, JSONSchema7Definition>;
		for (const k of Object.keys(aMap)) {
			const aVal = aMap[k];
			const bVal = bMap[k];
			if (
				aVal !== undefined &&
				bVal !== undefined &&
				hasOwn(bMap, k) &&
				hasFormatConflict(aVal, bVal)
			) {
				return true;
			}
		}
	}

	// Check items (single schema)
	if (isPlainObj(a.items) && isPlainObj(b.items)) {
		if (
			hasFormatConflict(
				a.items as JSONSchema7Definition,
				b.items as JSONSchema7Definition,
			)
		)
			return true;
	}

	// Check additionalProperties
	if (
		isPlainObj(a.additionalProperties) &&
		isPlainObj(b.additionalProperties)
	) {
		if (
			hasFormatConflict(
				a.additionalProperties as JSONSchema7Definition,
				b.additionalProperties as JSONSchema7Definition,
			)
		)
			return true;
	}

	return false;
}

// ─── Constraints merge helpers ───────────────────────────────────────────────

// `toConstraintArray` and `mergeConstraints` are imported from `./utils.ts`.
// They are shared with `condition-resolver.ts`.

/**
 * Returns `true` if the schema (or any of its nested sub-schemas) contains
 * the custom `constraints` keyword. Used as a cheap guard to skip the
 * expensive `applyConstraintsMerge` post-processor when no constraints
 * exist in either input — which is the overwhelmingly common case.
 *
 * Recurses into: `properties`, `patternProperties`, `items` (single or
 * tuple), `additionalProperties`, `dependencies` (schema form).
 */
function hasConstraintsAnywhere(schema: JSONSchema7Definition): boolean {
	if (typeof schema === "boolean") return false;

	if (hasOwn(schema, "constraints") && schema.constraints !== undefined) {
		return true;
	}

	if (isPlainObj(schema.properties)) {
		const props = schema.properties as Record<string, JSONSchema7Definition>;
		for (const key of Object.keys(props)) {
			const prop = props[key];
			if (prop !== undefined && hasConstraintsAnywhere(prop)) return true;
		}
	}

	if (isPlainObj(schema.patternProperties)) {
		const pp = schema.patternProperties as Record<
			string,
			JSONSchema7Definition
		>;
		for (const key of Object.keys(pp)) {
			const val = pp[key];
			if (val !== undefined && hasConstraintsAnywhere(val)) return true;
		}
	}

	if (Array.isArray(schema.items)) {
		for (const item of schema.items as JSONSchema7Definition[]) {
			if (item !== undefined && hasConstraintsAnywhere(item)) return true;
		}
	} else if (isPlainObj(schema.items)) {
		if (hasConstraintsAnywhere(schema.items as JSONSchema7Definition))
			return true;
	}

	if (isPlainObj(schema.additionalProperties)) {
		if (
			hasConstraintsAnywhere(
				schema.additionalProperties as JSONSchema7Definition,
			)
		)
			return true;
	}

	if (isPlainObj(schema.dependencies)) {
		const deps = schema.dependencies as Record<
			string,
			JSONSchema7Definition | string[]
		>;
		for (const key of Object.keys(deps)) {
			const val = deps[key];
			if (
				val !== undefined &&
				!Array.isArray(val) &&
				hasConstraintsAnywhere(val as JSONSchema7Definition)
			)
				return true;
		}
	}

	return false;
}

/**
 * Recursively applies constraint merging to a schema that was produced
 * by the `shallowAllOfMerge` engine. The external library does not know
 * about our custom `constraints` keyword, so it applies an arbitrary
 * default (identity / last-wins). This post-processor walks the merged
 * result and replaces `constraints` with the proper union from both
 * original input schemas.
 *
 * **Performance guard:** If neither `a` nor `b` contains `constraints`
 * anywhere in their schema tree, returns `merged` immediately with zero
 * allocation. This is the overwhelmingly common case (schemas without
 * custom constraints), so the guard eliminates the shallow copy + recursion
 * overhead that was causing a ~10-25% regression on every merge call.
 *
 * Recurses into: `properties`, `patternProperties`, `items` (single or
 * tuple), `additionalProperties`, `dependencies` (schema form).
 */
function applyConstraintsMerge(
	merged: JSONSchema7Definition,
	a: JSONSchema7Definition,
	b: JSONSchema7Definition,
): JSONSchema7Definition {
	if (typeof merged === "boolean") return merged;
	if (typeof a === "boolean" || typeof b === "boolean") return merged;

	// ── Fast path: no constraints anywhere → return merged as-is ──
	// The guard checks only the original inputs (a, b). If neither has
	// constraints, the merged result cannot have meaningful constraints
	// either — skip the shallow copy and recursive traversal entirely.
	if (!hasConstraintsAnywhere(a) && !hasConstraintsAnywhere(b)) {
		return merged;
	}

	let changed = false;
	const result = { ...merged };

	// ── Root-level constraints ──
	const mergedConstraints = mergeConstraints(a.constraints, b.constraints);
	const currentConstraints = result.constraints;

	if (mergedConstraints !== undefined) {
		if (!deepEqual(currentConstraints, mergedConstraints)) {
			result.constraints = mergedConstraints;
			changed = true;
		}
	} else if (currentConstraints !== undefined) {
		delete result.constraints;
		changed = true;
	}

	// ── Recurse into properties ──
	if (
		isPlainObj(result.properties) &&
		(isPlainObj(a.properties) || isPlainObj(b.properties))
	) {
		const mergedProps = result.properties as Record<
			string,
			JSONSchema7Definition
		>;
		const aProps = (a.properties ?? {}) as Record<
			string,
			JSONSchema7Definition
		>;
		const bProps = (b.properties ?? {}) as Record<
			string,
			JSONSchema7Definition
		>;

		let propsChanged = false;
		const newProps: Record<string, JSONSchema7Definition> = {};

		for (const key of Object.keys(mergedProps)) {
			const mProp = mergedProps[key];
			const aProp = aProps[key];
			const bProp = bProps[key];

			if (mProp === undefined) continue;

			// Only recurse if both originals exist and are object schemas
			if (
				aProp !== undefined &&
				bProp !== undefined &&
				typeof mProp !== "boolean" &&
				typeof aProp !== "boolean" &&
				typeof bProp !== "boolean"
			) {
				const patched = applyConstraintsMerge(mProp, aProp, bProp);
				newProps[key] = patched;
				if (patched !== mProp) propsChanged = true;
			} else {
				newProps[key] = mProp;
			}
		}

		if (propsChanged) {
			result.properties = newProps;
			changed = true;
		}
	}

	// ── Recurse into items (single schema) ──
	if (isPlainObj(result.items) && isPlainObj(a.items) && isPlainObj(b.items)) {
		const patched = applyConstraintsMerge(
			result.items as JSONSchema7Definition,
			a.items as JSONSchema7Definition,
			b.items as JSONSchema7Definition,
		);
		if (patched !== result.items) {
			result.items = patched;
			changed = true;
		}
	}

	// ── Recurse into patternProperties ──
	if (
		isPlainObj(result.patternProperties) &&
		(isPlainObj(a.patternProperties) || isPlainObj(b.patternProperties))
	) {
		const mergedPP = result.patternProperties as Record<
			string,
			JSONSchema7Definition
		>;
		const aPP = (a.patternProperties ?? {}) as Record<
			string,
			JSONSchema7Definition
		>;
		const bPP = (b.patternProperties ?? {}) as Record<
			string,
			JSONSchema7Definition
		>;

		let ppChanged = false;
		const newPP: Record<string, JSONSchema7Definition> = {};

		for (const key of Object.keys(mergedPP)) {
			const mVal = mergedPP[key];
			const aVal = aPP[key];
			const bVal = bPP[key];

			if (mVal === undefined) continue;

			if (
				aVal !== undefined &&
				bVal !== undefined &&
				typeof mVal !== "boolean" &&
				typeof aVal !== "boolean" &&
				typeof bVal !== "boolean"
			) {
				const patched = applyConstraintsMerge(mVal, aVal, bVal);
				newPP[key] = patched;
				if (patched !== mVal) ppChanged = true;
			} else {
				newPP[key] = mVal;
			}
		}

		if (ppChanged) {
			result.patternProperties = newPP;
			changed = true;
		}
	}

	// ── Recurse into tuple items (array of schemas) ──
	if (
		Array.isArray(result.items) &&
		Array.isArray(a.items) &&
		Array.isArray(b.items)
	) {
		const mergedItems = result.items as JSONSchema7Definition[];
		const aItems = a.items as JSONSchema7Definition[];
		const bItems = b.items as JSONSchema7Definition[];
		const len = mergedItems.length;

		let tupleChanged = false;
		const newItems: JSONSchema7Definition[] = new Array(len);

		for (let i = 0; i < len; i++) {
			const mItem = mergedItems[i];
			const aItem = aItems[i];
			const bItem = bItems[i];

			if (
				mItem !== undefined &&
				aItem !== undefined &&
				bItem !== undefined &&
				typeof mItem !== "boolean" &&
				typeof aItem !== "boolean" &&
				typeof bItem !== "boolean"
			) {
				const patched = applyConstraintsMerge(mItem, aItem, bItem);
				newItems[i] = patched;
				if (patched !== mItem) tupleChanged = true;
			} else {
				newItems[i] = mItem as JSONSchema7Definition;
			}
		}

		if (tupleChanged) {
			result.items = newItems;
			changed = true;
		}
	}

	// ── Recurse into additionalProperties (schema form) ──
	if (
		isPlainObj(result.additionalProperties) &&
		isPlainObj(a.additionalProperties) &&
		isPlainObj(b.additionalProperties)
	) {
		const patched = applyConstraintsMerge(
			result.additionalProperties as JSONSchema7Definition,
			a.additionalProperties as JSONSchema7Definition,
			b.additionalProperties as JSONSchema7Definition,
		);
		if (patched !== result.additionalProperties) {
			result.additionalProperties = patched;
			changed = true;
		}
	}

	// ── Recurse into dependencies (schema form) ──
	if (
		isPlainObj(result.dependencies) &&
		(isPlainObj(a.dependencies) || isPlainObj(b.dependencies))
	) {
		const mergedDeps = result.dependencies as Record<
			string,
			JSONSchema7Definition | string[]
		>;
		const aDeps = (a.dependencies ?? {}) as Record<
			string,
			JSONSchema7Definition | string[]
		>;
		const bDeps = (b.dependencies ?? {}) as Record<
			string,
			JSONSchema7Definition | string[]
		>;

		let depsChanged = false;
		const newDeps: Record<string, JSONSchema7Definition | string[]> = {};

		for (const key of Object.keys(mergedDeps)) {
			const mVal = mergedDeps[key];
			const aVal = aDeps[key];
			const bVal = bDeps[key];

			if (mVal === undefined) continue;

			// Only recurse for schema-form dependencies (not string-array form)
			if (
				aVal !== undefined &&
				bVal !== undefined &&
				!Array.isArray(mVal) &&
				!Array.isArray(aVal) &&
				!Array.isArray(bVal) &&
				typeof mVal !== "boolean" &&
				typeof aVal !== "boolean" &&
				typeof bVal !== "boolean"
			) {
				const patched = applyConstraintsMerge(
					mVal as JSONSchema7Definition,
					aVal as JSONSchema7Definition,
					bVal as JSONSchema7Definition,
				);
				newDeps[key] = patched;
				if (patched !== mVal) depsChanged = true;
			} else {
				newDeps[key] = mVal;
			}
		}

		if (depsChanged) {
			result.dependencies = newDeps;
			changed = true;
		}
	}

	return changed ? result : merged;
}

// ─── MergeEngine class ───────────────────────────────────────────────────────

export class MergeEngine {
	private readonly compareFn: (
		a: JSONSchema7Definition,
		b: JSONSchema7Definition,
	) => number;

	private readonly shallowAllOfMergeFn: (
		schema: JSONSchema7 & { allOf: JSONSchema7Definition[] },
	) => JSONSchema7Definition;

	constructor() {
		const { compareSchemaDefinitions, compareSchemaValues } =
			createComparator();

		// ── Null-safe wrapper for compareSchemaValues ──
		// The library's compareSchemaValues has a bug: when both a and b are null,
		// it returns -1 instead of 0 (the null check for `a` fires before checking
		// if `b` is also null). This causes createIntersector to lose null values
		// during enum intersection (the sort-merge join relies on compare(x,x)===0).
		const safeCompareSchemaValues = (
			a: JSONSchema7Type,
			b: JSONSchema7Type,
		): number => {
			if (a === null && b === null) return 0;
			return compareSchemaValues(a, b);
		};

		const { mergeArrayOfSchemaDefinitions } = createMerger({
			intersectJson: createIntersector(safeCompareSchemaValues),
			deduplicateJsonSchemaDef: createDeduplicator(compareSchemaDefinitions),
		});

		this.compareFn = compareSchemaDefinitions;
		this.shallowAllOfMergeFn = createShallowAllOfMerge(
			mergeArrayOfSchemaDefinitions,
		);
	}

	/**
	 * Merges two schemas via `allOf([a, b])`.
	 * Returns `null` if the schemas are incompatible.
	 *
	 * Post-merge: detects `const` conflicts that the library
	 * does not capture (it uses `identity` for `const`).
	 */
	merge(
		a: JSONSchema7Definition,
		b: JSONSchema7Definition,
	): JSONSchema7Definition | null {
		// ── Trivial fast paths ──
		// Avoid expensive recursive conflict checks and external merge calls
		// for the most common identity/boolean intersection cases.
		if (a === b) return a;
		if (a === false || b === false) return false;
		if (a === true) return b;
		if (b === true) return a;

		// Pre-check: const conflict detectable before the merge
		if (hasDeepConstConflict(a, b)) {
			return null;
		}

		// Pre-check: format conflict (BOTH have an incompatible format)
		if (hasFormatConflict(a, b)) {
			return null;
		}

		// Pre-check: additionalProperties vs extra REQUIRED properties conflict
		// Only detects cases where a property is simultaneously forbidden
		// (additionalProperties: false) and required (required) → empty intersection.
		// Cases where properties are merely defined without being required
		// are handled correctly by the merge library itself.
		if (hasAdditionalPropertiesConflict(a, b)) {
			return null;
		}

		try {
			const result = this.shallowAllOfMergeFn({ allOf: [a, b] });
			// Post-merge: the external library does not handle our custom
			// `constraints` keyword — apply union + deduplication.
			return applyConstraintsMerge(result, a, b);
		} catch {
			return null;
		}
	}

	/**
	 * Merges via `shallowAllOfMerge` — throws an exception if incompatible.
	 * Useful when you want to capture the error for diagnostics.
	 *
	 * Post-merge: detects `const` conflicts and throws an exception.
	 */
	mergeOrThrow(
		a: JSONSchema7Definition,
		b: JSONSchema7Definition,
	): JSONSchema7Definition {
		// ── Trivial fast paths ──
		// Keep mergeOrThrow aligned with merge() for the common boolean/identity
		// intersections that can be resolved without touching the merge library.
		if (a === b) return a;
		if (a === false || b === false) return false;
		if (a === true) return b;
		if (b === true) return a;

		// Pre-check: const conflict
		if (hasDeepConstConflict(a, b)) {
			throw new Error(
				"Incompatible const values: schemas have conflicting const constraints",
			);
		}

		// Pre-check: format conflict
		if (hasFormatConflict(a, b)) {
			throw new Error(
				"Incompatible format values: schemas have conflicting format constraints",
			);
		}

		// Pre-check: additionalProperties vs extra REQUIRED properties conflict
		if (hasAdditionalPropertiesConflict(a, b)) {
			throw new Error(
				"Incompatible additionalProperties: required properties conflict with additionalProperties constraint",
			);
		}

		const result = this.shallowAllOfMergeFn({ allOf: [a, b] });
		// Post-merge: apply constraints union + deduplication.
		return applyConstraintsMerge(result, a, b);
	}

	/**
	 * Structurally compares two schema definitions.
	 * Returns 0 if they are identical, otherwise a non-zero integer.
	 */
	compare(a: JSONSchema7Definition, b: JSONSchema7Definition): number {
		return this.compareFn(a, b);
	}

	/**
	 * Checks structural equality between two schema definitions.
	 */
	isEqual(a: JSONSchema7Definition, b: JSONSchema7Definition): boolean {
		return this.compareFn(a, b) === 0;
	}

	// ── Overlay (sequential spread) ────────────────────────────────────────

	/**
	 * Computes a **deep** schema overlay: properties from `override`
	 * **replace** same-named properties in `base` using last-writer-wins
	 * spread semantics. When both the base and override define the same
	 * property as object-like schemas, the overlay **recurses** into that
	 * property so that nested sub-properties are spread rather than
	 * wholesale-replaced.
	 *
	 * This is the correct operation for sequential pipeline context
	 * accumulation where each node overwrites keys it produces:
	 *
	 * ```ts
	 * // Runtime semantics (deep spread):
	 * context = deepSpread(context, node.output)
	 * ```
	 *
	 * Unlike `merge` / `mergeOrThrow` (which compute `allOf` — the set
	 * **intersection**), `overlay` is **non-commutative**: the order of
	 * arguments matters. `base` is what existed before, `override` is
	 * what the new node produces.
	 *
	 * Behavior per keyword:
	 * - **`properties`**: deep spread — when both base and override define
	 *   the same property and both are object-like, `overlay` recurses.
	 *   Otherwise the override's property replaces the base's.
	 *   Base-only properties are always kept.
	 * - **`required`**: union of both arrays (a property that was required
	 *   before or is required by the override stays required).
	 * - **`additionalProperties`**: override wins if present, else base.
	 * - **Other object-level keywords** (`minProperties`, `maxProperties`,
	 *   `propertyNames`, `patternProperties`, `dependencies`): override
	 *   wins if present, else base is kept.
	 * - **Non-object schemas**: if either schema is not an object schema
	 *   (no `properties`, no `type: "object"`), the override replaces
	 *   the base entirely — there are no properties to spread.
	 *
	 * @param base - The existing accumulated schema (what came before)
	 * @param override - The new schema to overlay on top (last writer)
	 * @returns A new schema with deep spread semantics applied
	 *
	 * @example
	 * ```ts
	 * const base = {
	 *   type: "object",
	 *   properties: {
	 *     accountId: { type: "string", enum: ["a", "b"] },
	 *     config: {
	 *       type: "object",
	 *       properties: {
	 *         host: { type: "string" },
	 *         port: { type: "integer" },
	 *       },
	 *       required: ["host", "port"],
	 *     },
	 *   },
	 *   required: ["accountId", "config"],
	 * };
	 *
	 * const override = {
	 *   type: "object",
	 *   properties: {
	 *     accountId: { type: "string" },  // widens the type
	 *     config: {
	 *       type: "object",
	 *       properties: {
	 *         host: { type: "string", format: "hostname" },
	 *       },
	 *     },
	 *   },
	 *   required: ["accountId"],
	 * };
	 *
	 * engine.overlay(base, override);
	 * // → {
	 * //     type: "object",
	 * //     properties: {
	 * //       accountId: { type: "string" },          ← override wins (flat)
	 * //       config: {
	 * //         type: "object",
	 * //         properties: {
	 * //           host: { type: "string", format: "hostname" },  ← override wins (deep)
	 * //           port: { type: "integer" },                     ← kept from base (deep)
	 * //         },
	 * //         required: ["host", "port"],
	 * //       },
	 * //     },
	 * //     required: ["accountId", "config"],
	 * //   }
	 * ```
	 */
	overlay(
		base: JSONSchema7Definition,
		override: JSONSchema7Definition,
	): JSONSchema7Definition {
		// ── Boolean schema fast paths ──
		// `false` absorbs everything (no values allowed)
		if (override === false) return false;
		// `true` (accept everything) as override means base is completely replaced
		if (override === true) return true;
		// `true`/`false` base with a real override → override wins entirely
		if (typeof base === "boolean") return override;

		const baseObj = base as JSONSchema7;
		const overrideObj = override as JSONSchema7;

		// ── Non-object schemas: override replaces entirely ──
		// If neither schema looks like an object schema, there's no
		// property-level spreading to do — the override simply wins.
		if (!isObjectLike(baseObj) && !isObjectLike(overrideObj)) {
			return override;
		}

		// ── If only the override is object-like, it replaces entirely ──
		if (!isObjectLike(baseObj)) {
			return override;
		}

		// ── If only the base is object-like, override replaces entirely ──
		// (the override is a non-object schema — it redefines the shape)
		if (!isObjectLike(overrideObj)) {
			return override;
		}

		// ── Both are object-like: deep spread properties ──
		const baseProps = (baseObj.properties ?? {}) as Record<
			string,
			JSONSchema7Definition
		>;
		const overrideProps = (overrideObj.properties ?? {}) as Record<
			string,
			JSONSchema7Definition
		>;

		// Deep spread: for each property, recurse if both sides are object-like,
		// otherwise override wins. Base-only properties are kept as-is.
		const mergedProps: Record<string, JSONSchema7Definition> = {};

		// 1. Copy all base properties (may be overridden below)
		for (const key of Object.keys(baseProps)) {
			const baseProp = baseProps[key];
			if (baseProp === undefined) continue;
			mergedProps[key] = baseProp;
		}

		// 2. Apply override properties — recurse when both are object-like
		for (const key of Object.keys(overrideProps)) {
			const overrideProp = overrideProps[key];
			if (overrideProp === undefined) continue;

			const baseProp = baseProps[key];

			// If this property exists in both and both are object-like schemas,
			// recurse to deep-spread their sub-properties.
			if (
				baseProp !== undefined &&
				typeof baseProp !== "boolean" &&
				typeof overrideProp !== "boolean" &&
				isObjectLike(baseProp as JSONSchema7) &&
				isObjectLike(overrideProp as JSONSchema7)
			) {
				mergedProps[key] = this.overlay(baseProp, overrideProp);
			} else {
				// Otherwise: override wins entirely (primitive, array, type change, etc.)
				mergedProps[key] = overrideProp;
			}
		}

		// Union of required arrays
		const baseRequired = Array.isArray(baseObj.required)
			? baseObj.required
			: [];
		const overrideRequired = Array.isArray(overrideObj.required)
			? overrideObj.required
			: [];
		const mergedRequired = unionStrings(baseRequired, overrideRequired);

		// Start from base, apply override's object-level keywords on top
		const result: JSONSchema7 = { ...baseObj };

		// Always set the merged properties
		result.properties = mergedProps;

		// Set required only if non-empty
		if (mergedRequired.length > 0) {
			result.required = mergedRequired;
		} else {
			delete result.required;
		}

		// Override-wins for object-level constraint keywords
		if (hasOwn(overrideObj, "additionalProperties")) {
			result.additionalProperties = overrideObj.additionalProperties;
		}
		if (hasOwn(overrideObj, "minProperties")) {
			result.minProperties = overrideObj.minProperties;
		}
		if (hasOwn(overrideObj, "maxProperties")) {
			result.maxProperties = overrideObj.maxProperties;
		}
		if (hasOwn(overrideObj, "propertyNames")) {
			result.propertyNames = overrideObj.propertyNames;
		}
		if (hasOwn(overrideObj, "patternProperties")) {
			result.patternProperties = overrideObj.patternProperties;
		}
		if (hasOwn(overrideObj, "dependencies")) {
			result.dependencies = overrideObj.dependencies;
		}

		// Override type if explicitly provided
		if (hasOwn(overrideObj, "type")) {
			result.type = overrideObj.type;
		}

		return result;
	}
}

// ─── Overlay helpers ─────────────────────────────────────────────────────────

/** Object-level keywords that indicate a schema describes an object shape. */
const OBJECT_SHAPE_KEYWORDS: ReadonlyArray<string> = [
	"properties",
	"patternProperties",
	"additionalProperties",
	"required",
	"dependencies",
	"propertyNames",
	"minProperties",
	"maxProperties",
];

/**
 * Heuristic: does this schema look like it describes an object?
 * True if `type` is `"object"` or if any object-shape keyword is present.
 */
function isObjectLike(schema: JSONSchema7): boolean {
	if (schema.type === "object") return true;
	for (const kw of OBJECT_SHAPE_KEYWORDS) {
		if (hasOwn(schema, kw)) return true;
	}
	return false;
}
