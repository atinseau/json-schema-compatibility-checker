import type { JSONSchema7, JSONSchema7Definition } from "json-schema";
import { isFormatSubset } from "./format-validator.ts";
import type { MergeEngine } from "./merge-engine.ts";
import { normalize } from "./normalizer.ts";
import { isPatternSubset } from "./pattern-subset.ts";
import { computeSemanticErrors } from "./semantic-errors.ts";
import type { SchemaError, SubsetResult } from "./types.ts";
import {
	deepEqual,
	hasOwn,
	isPlainObj,
	omitKeys,
	semanticDeepEqual,
} from "./utils.ts";

// ─── Subset Checker ──────────────────────────────────────────────────────────
//
// Subset verification logic via the approach:
//   A ⊆ B  ⟺  A ∩ B ≡ A
//
// Handles:
//   - Atomic schemas (no anyOf/oneOf)
//   - anyOf/oneOf in sub → each branch must be accepted by sup
//   - anyOf/oneOf in sup → at least one branch must accept sub
//   - Point 6: Distinguish anyOf / oneOf in diff messages
//   - Point 7: Extended `not` reasoning (evaluateNot)
//     - not.type, not.const, not.enum (existing)
//     - not with properties+required (1.1)
//     - not with anyOf/oneOf (1.2)
//     - not in sub (1.3)
//     - not.format (format-vs-format)
//
// Uses shared native helpers from `./utils` for optimal performance
// (deepEqual, hasOwn, isPlainObj, omitKeys).

// ─── Branch type ─────────────────────────────────────────────────────────────

/**
 * Branch type detected in a schema.
 *
 * Point 6 — Distinguishes `anyOf` from `oneOf` to produce more precise
 * diff messages. `"none"` indicates an atomic schema (no branches).
 *
 * Note: the exclusivity semantics of `oneOf` are not verified
 * (this would be an NP-hard problem in general). The checker treats `oneOf`
 * like `anyOf` for subset checking, which is correct for the `sub ⊆ sup`
 * case but may produce false positives if the sub's branches overlap.
 */
export type BranchType = "anyOf" | "oneOf" | "none";

export interface BranchResult {
	/** The branches extracted from the schema */
	branches: JSONSchema7Definition[];
	/** The detected branch type */
	type: BranchType;
}

// ─── Branch extraction ───────────────────────────────────────────────────────

// Pre-allocated singleton results for boolean schemas to avoid per-call allocations.
// These are safe because the branches arrays are never mutated after creation.
const BRANCH_TRUE: BranchResult = { branches: [true], type: "none" };
const BRANCH_FALSE: BranchResult = { branches: [false], type: "none" };

/**
 * WeakMap cache for atomic (no anyOf/oneOf) schema branch results.
 * Avoids allocating `{ branches: [def], type: "none" }` on every call
 * for the same schema object. Since normalized schemas are cached and
 * return the same reference, this cache hits frequently.
 */
const atomicBranchCache = new WeakMap<object, BranchResult>();

/**
 * Extracts branches from a schema and the branch type.
 *
 * Returns the elements of `anyOf`/`oneOf` if they exist, otherwise returns
 * the schema itself in an array with type `"none"`.
 *
 * Point 6 — Distinguishes `anyOf` from `oneOf` in diff paths.
 *
 * Optimization: reuses pre-allocated objects for boolean cases
 * (true/false) and a WeakMap cache for atomic schemas to
 * avoid allocations on these frequent paths.
 */
export function getBranchesTyped(def: JSONSchema7Definition): BranchResult {
	if (typeof def === "boolean") {
		return def ? BRANCH_TRUE : BRANCH_FALSE;
	}
	if (hasOwn(def, "anyOf") && Array.isArray(def.anyOf)) {
		return { branches: def.anyOf, type: "anyOf" };
	}
	if (hasOwn(def, "oneOf") && Array.isArray(def.oneOf)) {
		return { branches: def.oneOf, type: "oneOf" };
	}
	// Cache atomic results per schema object to avoid repeated allocations.
	let cached = atomicBranchCache.get(def);
	if (cached === undefined) {
		cached = { branches: [def], type: "none" };
		atomicBranchCache.set(def, cached);
	}
	return cached;
}

// ─── `not` reasoning (Point 7 — extended) ────────────────────────────────────

/**
 * Extended `not` reasoning for common cases.
 *
 * Point 7 — Checks compatibility when `sup` and/or `sub` contain `not`:
 *
 * **Existing cases (not in sup):**
 *   - `not.type`: excluded type vs sub's type
 *   - `not.const`: excluded const vs sub's const
 *   - `not.enum`: excluded values vs sub's enum
 *
 * **Added cases:**
 *   - 1.1 — `not` with `properties` + `required`: verify that sub's properties
 *     are incompatible with the `not`'s properties (different const/enum)
 *   - 1.2 — `not` with `anyOf`/`oneOf`: `not(anyOf([A,B]))` ≡ `allOf([not(A), not(B)])`,
 *     so sub must be incompatible with EACH branch
 *   - 1.3 — `not` in `sub` (not only in `sup`): a sub with `not`
 *     accepts a set too wide to be a subset of a concrete sup
 *   - `not.format`: format-vs-format via `isFormatSubset`
 *
 * Conservative ternary contract:
 *   - `true`  → compatible (certain)
 *   - `false` → incompatible (certain)
 *   - `null`  → undetermined (let the merge engine decide)
 *
 * When in doubt → `null`. NEVER return `true` without certainty.
 */
function evaluateNot(
	sub: JSONSchema7Definition,
	sup: JSONSchema7Definition,
): boolean | null {
	if (typeof sub === "boolean" || typeof sup === "boolean") return null;

	// ── 1.3 — `not` in sub (not in sup) ──
	// A `not` in sub is an additional restriction: it excludes values from
	// the set accepted by sub, which makes it potentially smaller — thus
	// more likely to be ⊆ sup, not less.
	// We let the merge engine decide: allOf(sub, sup) will preserve the `not`
	// from sub, and the comparison merged ≡ sub will give the correct result.
	// Exception: if both have `not`, we handle the identity case below.

	// Check `not` in sup
	if (hasOwn(sup, "not") && isPlainObj(sup.not)) {
		const notSchema = sup.not as JSONSchema7;

		// ── 1.1 — Case not with properties + required ──
		// IMPORTANT: this check is placed BEFORE the not.type check because when
		// the not has both `type` and `properties`, the not.type check alone
		// would produce a false negative (e.g. sub type=object and not type=object
		// would return false, but the properties could be incompatible
		// which would make sub compatible with the not).
		// If not contains properties with const/enum and required,
		// verify that sub's properties are incompatible with the not's properties.
		if (isPlainObj(notSchema.properties) && Array.isArray(notSchema.required)) {
			const notProps = notSchema.properties as Record<
				string,
				JSONSchema7Definition
			>;
			const notRequired = notSchema.required as string[];

			// sub must have properties for us to compare
			if (isPlainObj(sub.properties)) {
				const subProps = sub.properties as Record<
					string,
					JSONSchema7Definition
				>;
				const subRequired = Array.isArray(sub.required)
					? (sub.required as string[])
					: [];
				const notPropKeys = Object.keys(notProps);

				// For sub to be compatible with not(schema),
				// it suffices that at least ONE property of the not is incompatible with sub.
				// This means that sub can never validate the schema inside not.
				const hasIncompatibleProp = notPropKeys.some((key) => {
					const notPropDef = notProps[key];
					if (typeof notPropDef === "boolean") return false;
					const notProp = notPropDef as JSONSchema7;

					// If the property is required in not but NOT in sub.required
					// and it doesn't exist in sub.properties → sub may not
					// have this property → the not schema wouldn't match → compatible
					if (
						notRequired.includes(key) &&
						!subRequired.includes(key) &&
						!hasOwn(subProps, key)
					) {
						return true; // Property absent from sub → not doesn't match
					}

					// Compare the const/enum of the property
					if (!hasOwn(subProps, key)) return false;
					const subPropDef = subProps[key];
					if (typeof subPropDef === "boolean") return false;
					const subProp = subPropDef as JSONSchema7;

					// not.prop has a const, sub.prop has a different const → incompatible for this prop
					if (hasOwn(notProp, "const") && hasOwn(subProp, "const")) {
						if (!deepEqual(notProp.const, subProp.const)) {
							return true; // Different consts → sub doesn't match the not
						}
					}

					// not.prop has an enum, sub.prop has a const or enum with no value
					// in not.enum → incompatible for this prop
					if (hasOwn(notProp, "enum") && Array.isArray(notProp.enum)) {
						if (hasOwn(subProp, "const")) {
							const inNotEnum = notProp.enum.some((v) =>
								deepEqual(v, subProp.const),
							);
							if (!inNotEnum) return true; // sub.const absent from not.enum
						}
						if (hasOwn(subProp, "enum") && Array.isArray(subProp.enum)) {
							const noneInNotEnum = subProp.enum.every(
								(v) => !notProp.enum?.some((nv) => deepEqual(v, nv)),
							);
							if (noneInNotEnum) return true; // No value from sub.enum in not.enum
						}
					}

					return false;
				});

				if (hasIncompatibleProp) return true;

				// Inverse check: if ALL properties of the not match sub
				// exactly (same const, sub has the not's required), then sub VIOLATES the not
				const allPropsMatch = notPropKeys.every((key) => {
					const notPropDef = notProps[key];
					if (typeof notPropDef === "boolean") return true;
					const notProp = notPropDef as JSONSchema7;

					// The property must be in sub.required if it is in not.required
					if (notRequired.includes(key) && !subRequired.includes(key))
						return false;
					if (!hasOwn(subProps, key)) return false;
					const subPropDef = subProps[key];
					if (typeof subPropDef === "boolean") return true;
					const subProp = subPropDef as JSONSchema7;

					// Check const match
					if (hasOwn(notProp, "const") && hasOwn(subProp, "const")) {
						return deepEqual(notProp.const, subProp.const);
					}

					// Check enum inclusion
					if (hasOwn(notProp, "enum") && Array.isArray(notProp.enum)) {
						if (hasOwn(subProp, "const")) {
							return notProp.enum.some((v) => deepEqual(v, subProp.const));
						}
						if (hasOwn(subProp, "enum") && Array.isArray(subProp.enum)) {
							// All values of sub.enum are in not.enum
							return subProp.enum.every((v) =>
								notProp.enum?.some((nv) => deepEqual(v, nv)),
							);
						}
					}

					return false; // Undetermined for this property
				});

				if (allPropsMatch) return false; // sub matches the not exactly → incompatible
			}
		}

		// ── Case not.const ──
		// IMPORTANT: this check is placed BEFORE not.type because when the not has
		// both `type` and `const`, the not.type check alone would produce a
		// false negative (e.g. sub type=string const="active" and not type=string
		// const="deleted" → the type check would return false due to same type,
		// even though the consts are different → compatible).
		if (hasOwn(notSchema, "const") && hasOwn(sub, "const")) {
			const notConst = notSchema.const;
			const subConst = sub.const;
			if (deepEqual(subConst, notConst)) return false;
			return true;
		}

		// ── Case not.const + sub.enum ──
		// When sub has enum and not has const, check that the forbidden const
		// is not in sub's enum values. If none match → compatible.
		if (hasOwn(notSchema, "const") && Array.isArray(sub.enum)) {
			const notConst = notSchema.const;
			const allDisjoint = sub.enum.every((v) => !deepEqual(v, notConst));
			if (allDisjoint) return true;
			// At least one enum value equals the forbidden const → incompatible
			return false;
		}

		// ── Case not.enum ──
		// Also placed BEFORE not.type for the same reason.
		if (
			hasOwn(notSchema, "enum") &&
			Array.isArray(notSchema.enum) &&
			hasOwn(sub, "enum") &&
			Array.isArray(sub.enum)
		) {
			// All values of sub.enum must be absent from not.enum
			const allExcluded = sub.enum.every(
				(val) => !notSchema.enum?.some((notVal) => deepEqual(val, notVal)),
			);
			if (allExcluded) return true;
			// Some values of sub are in not.enum → not automatically false,
			// the merge engine can still handle it
		}

		// ── Case not.enum + sub.const ──
		// When sub has const and not has enum, check that sub's const is not
		// in the forbidden enum values.
		if (
			hasOwn(notSchema, "enum") &&
			Array.isArray(notSchema.enum) &&
			hasOwn(sub, "const")
		) {
			const inNotEnum = notSchema.enum.some((v) => deepEqual(v, sub.const));
			if (!inNotEnum) return true;
			return false;
		}

		// ── Case not.type ──
		// Placed AFTER not.const, not.enum and properties+required to avoid
		// short-circuiting cases where the not has more specific constraints.
		// The type check alone is a fallback for simple not schemas
		// (e.g. { not: { type: "string" } }).
		if (hasOwn(notSchema, "type") && hasOwn(sub, "type")) {
			const notType = notSchema.type;
			const subType = sub.type;

			// If both are simple strings
			if (typeof notType === "string" && typeof subType === "string") {
				// Only return if the not does NOT have more specific constraints
				// (const, enum, properties) that should have been handled above
				if (
					!hasOwn(notSchema, "const") &&
					!hasOwn(notSchema, "enum") &&
					!isPlainObj(notSchema.properties)
				) {
					if (subType === notType) return false; // Incompatible: sub is exactly the excluded type
					return true; // Compatible: sub is a different type from the excluded type
				}
			}

			// If notType is an array, sub.type must not be in it
			if (Array.isArray(notType) && typeof subType === "string") {
				if (notType.includes(subType)) return false;
				return true;
			}
		}

		// ── 1.2 — Case not with anyOf / oneOf ──
		// not(anyOf([A, B])) ≡ allOf([not(A), not(B)])
		// For sub ⊆ not(anyOf(...)), sub must be incompatible with EACH branch.
		if (hasOwn(notSchema, "anyOf") && Array.isArray(notSchema.anyOf)) {
			const branches = notSchema.anyOf as JSONSchema7Definition[];
			// For each branch of not.anyOf, verify that sub is incompatible
			const allIncompatible = branches.every((branch) => {
				if (typeof branch === "boolean") return !branch; // not(true) = nothing, not(false) = everything
				// Create a virtual sup { not: branch } and verify recursively
				const result = evaluateNot(sub, { not: branch });
				// result = true → sub is compatible with not(branch) → sub ⊄ branch → OK
				// result = false → sub is incompatible with not(branch) → sub ⊆ branch → not OK
				// result = null → undetermined
				return result === true;
			});
			if (allIncompatible) return true;

			// Check if at least one branch accepts sub → incompatible with not(anyOf)
			const anyBranchMatches = branches.some((branch) => {
				if (typeof branch === "boolean") return branch;
				const result = evaluateNot(sub, { not: branch });
				return result === false; // sub is incompatible with not(branch) → sub ⊆ branch
			});
			if (anyBranchMatches) return false;
		}

		// Same logic for oneOf (in the not context, treated like anyOf)
		if (hasOwn(notSchema, "oneOf") && Array.isArray(notSchema.oneOf)) {
			const branches = notSchema.oneOf as JSONSchema7Definition[];
			const allIncompatible = branches.every((branch) => {
				if (typeof branch === "boolean") return !branch;
				const result = evaluateNot(sub, { not: branch });
				return result === true;
			});
			if (allIncompatible) return true;

			const anyBranchMatches = branches.some((branch) => {
				if (typeof branch === "boolean") return branch;
				const result = evaluateNot(sub, { not: branch });
				return result === false;
			});
			if (anyBranchMatches) return false;
		}

		// ── Case not.format (format-vs-format only) ──
		// If not has a format and sub also does, check compatibility
		if (hasOwn(notSchema, "format") && hasOwn(sub, "format")) {
			const subFormat = sub.format as string;
			const notFormat = notSchema.format as string;
			if (subFormat === notFormat) return false; // Incompatible: sub has exactly the excluded format
			// Different formats → compatible (conservative approximation)
			return true;
		}
	}

	// Check `not` in sub AND in sup (identity: { not: X } ⊆ { not: X })
	if (hasOwn(sub, "not") && hasOwn(sup, "not")) {
		if (deepEqual(sub.not, sup.not)) return true;
	}

	return null; // No opinion → let the merge engine decide
}

// ─── Not stripping helper ────────────────────────────────────────────────────

/**
 * Removes the `not` keyword from a schema to allow a clean merge
 * when `evaluateNot` has already confirmed compatibility.
 *
 * Also handles `not` nested in `properties`: if a property of `sup`
 * has a `not` that is compatible with the corresponding property of
 * `sub`, it is removed as well.
 *
 * Returns the cleaned schema, or `null` if the schema is empty after removal.
 */
function stripNotFromSup(
	sub: JSONSchema7Definition,
	sup: JSONSchema7Definition,
	stripTopLevel: boolean = true,
): JSONSchema7Definition {
	if (typeof sup === "boolean" || typeof sub === "boolean") return sup;

	let result = sup as JSONSchema7;

	// ── Remove top-level `not` (only if confirmed) ──
	if (stripTopLevel && hasOwn(result, "not")) {
		result = omitKeys(result as unknown as Record<string, unknown>, [
			"not",
		]) as JSONSchema7;
	}

	// ── Recursively remove `not` in common properties ──
	// For each shared property: if the sup property has a direct `not`,
	// evaluate and strip it. Then recurse deeper into nested objects so
	// that `not` constraints at any depth are handled.
	if (
		isPlainObj(result.properties) &&
		isPlainObj((sub as JSONSchema7).properties)
	) {
		const subProps = (sub as JSONSchema7).properties as Record<
			string,
			JSONSchema7Definition
		>;
		const supProps = result.properties as Record<string, JSONSchema7Definition>;
		let newProps: Record<string, JSONSchema7Definition> | undefined;

		for (const key of Object.keys(supProps)) {
			const supPropDef = supProps[key];
			const subPropDef = subProps[key];
			if (
				supPropDef === undefined ||
				subPropDef === undefined ||
				typeof supPropDef === "boolean" ||
				typeof subPropDef === "boolean"
			) {
				continue;
			}

			let strippedProp: JSONSchema7Definition = supPropDef;

			// Direct `not` on this property — evaluate and strip if confirmed
			if (hasOwn(supPropDef, "not")) {
				const propNotResult = evaluateNot(subPropDef, supPropDef);
				if (propNotResult === true) {
					strippedProp = omitKeys(
						supPropDef as unknown as Record<string, unknown>,
						["not"],
					) as JSONSchema7Definition;
				}
			}

			// Recurse into nested object properties (handles `not` at any depth)
			const recursed = stripNotFromSup(subPropDef, strippedProp, false);
			if (recursed !== supPropDef) {
				if (!newProps) newProps = { ...supProps };
				newProps[key] = recursed;
			}
		}

		if (newProps) {
			result = { ...result, properties: newProps };
		}
	}

	return result;
}

// ─── Pattern stripping helper ────────────────────────────────────────────────

/**
 * Removes the `pattern` from `sup` when `isPatternSubset` has confirmed that
 * sub.pattern ⊆ sup.pattern via sampling.
 *
 * Works like `stripNotFromSup`: we remove the sup constraint that is already
 * satisfied by sub, to prevent the merge engine from producing a combined
 * pattern (lookahead conjunction) structurally different from sub's pattern,
 * which would cause a false negative.
 *
 * Recurses into `properties` to handle nested patterns.
 *
 * @param sub  The sub schema (used to extract patterns to compare)
 * @param sup  The sup schema from which confirmed patterns are removed
 * @returns    The cleaned sup schema
 */
function stripPatternFromSup(
	sub: JSONSchema7Definition,
	sup: JSONSchema7Definition,
): JSONSchema7Definition {
	if (typeof sub === "boolean" || typeof sup === "boolean") return sup;

	const supObj: JSONSchema7 = sup;

	// Lazy copy-on-write: only create a copy when the first mutation is needed.
	let result: JSONSchema7 = supObj;
	let copied = false;

	function ensureCopy(): JSONSchema7 {
		if (!copied) {
			result = { ...supObj };
			copied = true;
		}
		return result;
	}

	// ── Top-level pattern ──
	if (
		hasOwn(result, "pattern") &&
		hasOwn(sub, "pattern") &&
		result.pattern !== (sub as JSONSchema7).pattern
	) {
		const patResult = isPatternSubset(
			(sub as JSONSchema7).pattern as string,
			result.pattern as string,
		);
		if (patResult === true) {
			result = omitKeys(ensureCopy() as unknown as Record<string, unknown>, [
				"pattern",
			]) as JSONSchema7;
			copied = true;
		}
	}

	// ── Patterns in common properties ──
	if (
		isPlainObj(result.properties) &&
		isPlainObj((sub as JSONSchema7).properties)
	) {
		const subProps = (sub as JSONSchema7).properties as Record<
			string,
			JSONSchema7Definition
		>;
		const supProps = result.properties as Record<string, JSONSchema7Definition>;
		let propsModified = false;
		let newProps: Record<string, JSONSchema7Definition> | undefined;

		for (const key of Object.keys(supProps)) {
			const supPropDef = supProps[key];
			const subPropDef = subProps[key];
			if (
				supPropDef !== undefined &&
				subPropDef !== undefined &&
				typeof supPropDef !== "boolean" &&
				typeof subPropDef !== "boolean" &&
				hasOwn(supPropDef, "pattern") &&
				hasOwn(subPropDef, "pattern") &&
				supPropDef.pattern !== subPropDef.pattern
			) {
				const propPatResult = isPatternSubset(
					(subPropDef as JSONSchema7).pattern as string,
					(supPropDef as JSONSchema7).pattern as string,
				);
				if (propPatResult === true) {
					if (!newProps) newProps = { ...supProps };
					newProps[key] = omitKeys(
						supPropDef as unknown as Record<string, unknown>,
						["pattern"],
					) as JSONSchema7Definition;
					propsModified = true;
				}
			}
		}

		if (propsModified && newProps) {
			ensureCopy().properties = newProps;
		}
	}

	// ── Pattern in items (single schema) ──
	if (
		isPlainObj(result.items) &&
		typeof result.items !== "boolean" &&
		isPlainObj((sub as JSONSchema7).items) &&
		typeof (sub as JSONSchema7).items !== "boolean"
	) {
		const subItems = (sub as JSONSchema7).items as JSONSchema7;
		const supItems = result.items as JSONSchema7;
		if (
			hasOwn(supItems, "pattern") &&
			hasOwn(subItems, "pattern") &&
			supItems.pattern !== subItems.pattern
		) {
			const itemsPatResult = isPatternSubset(
				subItems.pattern as string,
				supItems.pattern as string,
			);
			if (itemsPatResult === true) {
				ensureCopy().items = omitKeys(
					supItems as unknown as Record<string, unknown>,
					["pattern"],
				) as JSONSchema7Definition;
			}
		}
	}

	return result;
}

/**
 * Strips redundant numeric bounds from `sup` when `sub` already has a stricter
 * exclusive bound that implies the inclusive bound.
 *
 * For example, if sub has `exclusiveMinimum: 5` and sup has `minimum: 5`,
 * the sup's `minimum` is redundant because `x > 5` ⊂ `x ≥ 5`.
 */
function stripRedundantBoundsFromSup(
	sub: JSONSchema7Definition,
	sup: JSONSchema7Definition,
): JSONSchema7Definition {
	if (typeof sub === "boolean" || typeof sup === "boolean") return sup;

	const keysToStrip: string[] = [];

	// sub.exclusiveMinimum >= sup.minimum → sup.minimum is redundant
	if (
		sup.minimum !== undefined &&
		sub.minimum === undefined &&
		sub.exclusiveMinimum !== undefined &&
		sub.exclusiveMinimum >= sup.minimum
	) {
		keysToStrip.push("minimum");
	}

	// sub.exclusiveMaximum <= sup.maximum → sup.maximum is redundant
	if (
		sup.maximum !== undefined &&
		sub.maximum === undefined &&
		sub.exclusiveMaximum !== undefined &&
		sub.exclusiveMaximum <= sup.maximum
	) {
		keysToStrip.push("maximum");
	}

	// sub.minimum > sup.exclusiveMinimum → sup.exclusiveMinimum is redundant
	if (
		sup.exclusiveMinimum !== undefined &&
		sub.exclusiveMinimum === undefined &&
		sub.minimum !== undefined &&
		sub.minimum > sup.exclusiveMinimum
	) {
		keysToStrip.push("exclusiveMinimum");
	}

	// sub.maximum < sup.exclusiveMaximum → sup.exclusiveMaximum is redundant
	if (
		sup.exclusiveMaximum !== undefined &&
		sub.exclusiveMaximum === undefined &&
		sub.maximum !== undefined &&
		sub.maximum < sup.exclusiveMaximum
	) {
		keysToStrip.push("exclusiveMaximum");
	}

	// ── Top-level stripping ────────────────────────────────────
	let result: JSONSchema7Definition =
		keysToStrip.length > 0
			? (omitKeys(
					sup as unknown as Record<string, unknown>,
					keysToStrip,
				) as JSONSchema7)
			: sup;

	// ── Recurse into properties ────────────────────────────────
	const resultObj = result as JSONSchema7;
	if (isPlainObj(resultObj.properties) && isPlainObj(sub.properties)) {
		const subProps = sub.properties as Record<string, JSONSchema7Definition>;
		const supProps = resultObj.properties as Record<
			string,
			JSONSchema7Definition
		>;
		let newProps: Record<string, JSONSchema7Definition> | undefined;

		for (const key of Object.keys(supProps)) {
			const supProp = supProps[key];
			const subProp = subProps[key];

			if (
				supProp !== undefined &&
				subProp !== undefined &&
				typeof supProp !== "boolean" &&
				typeof subProp !== "boolean"
			) {
				const stripped = stripRedundantBoundsFromSup(subProp, supProp);
				if (stripped !== supProp) {
					if (!newProps) newProps = { ...supProps };
					newProps[key] = stripped;
				}
			}
		}

		if (newProps) {
			result = { ...resultObj, properties: newProps };
		}
	}

	return result;
}

/**
 * Strips `dependencies` from `sup` when every dependency is semantically
 * satisfied by `sub`'s structure:
 * - Array-form deps: all dependent properties are in `sub.required`, OR the
 *   trigger property is never produced by `sub` (not in properties + not required).
 * - Schema-form deps: only stripped when the trigger is never produced by `sub`.
 */
function stripDependenciesFromSup(
	sub: JSONSchema7Definition,
	sup: JSONSchema7Definition,
): JSONSchema7Definition {
	if (typeof sub === "boolean" || typeof sup === "boolean") return sup;
	if (!isPlainObj(sup.dependencies)) return sup;

	const supDeps = sup.dependencies as Record<
		string,
		JSONSchema7Definition | string[]
	>;
	const subRequired = Array.isArray(sub.required) ? sub.required : [];
	const subProps = isPlainObj(sub.properties)
		? (sub.properties as Record<string, JSONSchema7Definition>)
		: {};
	const subHasAdditionalPropsFalse = sub.additionalProperties === false;

	for (const key of Object.keys(supDeps)) {
		const dep = supDeps[key];

		if (Array.isArray(dep)) {
			// Array-form: satisfied if all dependents are always required,
			// OR the trigger is never produced by sub
			const triggerAlwaysPresent =
				subRequired.includes(key) || hasOwn(subProps, key);
			const triggerNeverProduced =
				!hasOwn(subProps, key) &&
				!subRequired.includes(key) &&
				subHasAdditionalPropsFalse;

			if (triggerNeverProduced) continue;

			if (triggerAlwaysPresent) {
				const allDepsRequired = dep.every((d) => subRequired.includes(d));
				if (allDepsRequired) continue;
			}

			// This dependency is not satisfied — cannot strip
			return sup;
		}

		// Schema-form: strip if trigger is never produced OR if sub satisfies the dep schema
		if (isPlainObj(dep)) {
			const triggerNeverProduced =
				!hasOwn(subProps, key) &&
				!subRequired.includes(key) &&
				subHasAdditionalPropsFalse;
			if (triggerNeverProduced) continue;

			// The trigger exists in sub — check if sub structurally satisfies the dep schema.
			// A schema-form dependency { A: { required: ['B'], properties: { B: S } } }
			// means "if A is present → the object must also match the dep schema".
			// If sub already satisfies the dep schema (all dep.required are in sub.required,
			// and all dep.properties exist in sub.properties), the dependency is trivially met.
			const depSchema = dep as JSONSchema7;
			const depRequired = Array.isArray(depSchema.required)
				? (depSchema.required as string[])
				: [];
			const depProps = isPlainObj(depSchema.properties)
				? (depSchema.properties as Record<string, JSONSchema7Definition>)
				: {};

			const allDepRequiredSatisfied = depRequired.every((r) =>
				subRequired.includes(r),
			);
			if (!allDepRequiredSatisfied) return sup;

			const allDepPropsSatisfied = Object.keys(depProps).every((propKey) => {
				if (!hasOwn(subProps, propKey)) return false;
				// Check that sub's property is at least as narrow as the dep's property.
				// For simple cases (same type, sub has stricter constraints), deepEqual
				// or a structural check suffices. We compare the dep property against
				// the sub property: if sub.properties[k] has all constraints from
				// dep.properties[k], the dep is satisfied for that property.
				const subPropDef = subProps[propKey];
				const depPropDef = depProps[propKey];
				if (subPropDef === undefined || depPropDef === undefined) return false;
				if (
					typeof subPropDef === "boolean" ||
					typeof depPropDef === "boolean"
				) {
					return subPropDef === depPropDef;
				}
				// If the sub property is structurally equal to or narrower than the dep property,
				// the dependency is satisfied. A simple heuristic: check that every keyword
				// in the dep property also exists in the sub property with an equal or stricter value.
				const depPropKeys = Object.keys(depPropDef);
				return depPropKeys.every((dk) => {
					const depVal = (depPropDef as Record<string, unknown>)[dk];
					const subVal = (subPropDef as Record<string, unknown>)[dk];
					if (subVal === undefined) return false;
					// For numeric constraints, sub must be at least as strict
					if (typeof depVal === "number" && typeof subVal === "number") {
						if (
							dk === "minLength" ||
							dk === "minimum" ||
							dk === "exclusiveMinimum" ||
							dk === "minItems" ||
							dk === "minProperties"
						) {
							return subVal >= depVal;
						}
						if (
							dk === "maxLength" ||
							dk === "maximum" ||
							dk === "exclusiveMaximum" ||
							dk === "maxItems" ||
							dk === "maxProperties"
						) {
							return subVal <= depVal;
						}
					}
					return deepEqual(depVal, subVal);
				});
			});
			if (!allDepPropsSatisfied) return sup;

			continue;
		}

		// Unknown form — cannot strip safely
		return sup;
	}

	// All dependencies satisfied → strip
	return omitKeys(sup as unknown as Record<string, unknown>, [
		"dependencies",
	]) as JSONSchema7;
}

// ─── Vacuous false-property stripping ────────────────────────────────────────
//
// In JSON Schema, `properties: { x: false }` means "if x is present, it must
// validate against `false` (impossible)". If x is **absent** from the instance,
// the constraint is **trivially satisfied** (vacuous truth).
//
// After merge(sub, sup), the merge engine may add `false`-schema properties
// from sup into the merged result even when sub doesn't define those properties.
// This causes `deepEqual(merged, sub)` to fail — a false negative.
//
// `stripVacuousFalseProperties` removes those vacuously-satisfied `false`
// properties from `merged` so that the structural comparison succeeds.

/**
 * Strips `false`-schema properties from `merged` that are absent in `sub`.
 *
 * A property `{ key: false }` in merged that doesn't exist in sub's properties
 * is vacuously satisfied — sub never produces that key, so the "impossible"
 * constraint has no effect. Removing it lets `deepEqual(merged, sub)` succeed.
 *
 * @returns A new schema with vacuous `false` properties removed, or the
 *          original `merged` if no stripping was needed.
 */
function stripVacuousFalseProperties(
	merged: JSONSchema7Definition,
	sub: JSONSchema7Definition,
): JSONSchema7Definition {
	if (typeof merged === "boolean" || typeof sub === "boolean") return merged;
	if (!isPlainObj(merged.properties)) return merged;

	const mergedProps = merged.properties as Record<
		string,
		JSONSchema7Definition
	>;
	const subProps = (isPlainObj(sub.properties) ? sub.properties : {}) as Record<
		string,
		JSONSchema7Definition
	>;

	let strippedProps: Record<string, JSONSchema7Definition> | null = null;

	for (const key of Object.keys(mergedProps)) {
		if (mergedProps[key] === false && !hasOwn(subProps, key)) {
			// Lazily copy on first strip
			if (strippedProps === null) {
				strippedProps = { ...mergedProps };
			}
			delete strippedProps[key];
		}
	}

	if (strippedProps === null) return merged;

	// Return a new schema with the cleaned properties
	const result = { ...merged, properties: strippedProps };

	// If properties is now empty and sub doesn't have properties, remove it
	if (Object.keys(strippedProps).length === 0 && !isPlainObj(sub.properties)) {
		delete (result as Record<string, unknown>).properties;
	}

	return result;
}

// ─── Nested branching fallback ───────────────────────────────────────────────
//
// The merge engine (`@x0k/json-schema-merge`) cannot resolve `allOf` over
// `oneOf`/`anyOf` inside properties — it either throws or produces garbage
// like `{ type: "string", oneOf: [...] }`.
//
// When the merge-based check fails (null or merged ≠ sub), and either schema
// contains `oneOf`/`anyOf` inside its properties or items, we fall back to a
// **property-by-property** comparison that uses the existing branching logic
// (`getBranchesTyped` / `isAtomicSubsetOf`) on each sub-schema individually.
//
// Three helpers:
//   1. `hasNestedBranching` — guard: does a schema contain oneOf/anyOf in
//      properties or items? Avoids triggering the fallback on normal schemas.
//   2. `isPropertySubsetOf` — compares a single property sub-schema handling
//      branches on both sides (sub may have oneOf, sup may have oneOf).
//   3. `isObjectSubsetByProperties` — the fallback itself: iterates over
//      object properties + items and delegates to `isPropertySubsetOf`.
//   4. `tryNestedBranchingFallback` — the single entry point called from
//      `isAtomicSubsetOf` and `checkAtomic`. Encapsulates the guard check
//      and the call, returning `boolean | null` (null = not applicable).

/**
 * Returns `true` if the schema contains `oneOf`/`anyOf` inside its
 * `properties` or `items`. Recurses into nested object schemas.
 *
 * This is a cheap guard so we only attempt the property-by-property
 * fallback when the merge failure is plausibly caused by nested branching.
 */
function hasNestedBranching(schema: JSONSchema7Definition): boolean {
	if (typeof schema === "boolean") return false;

	if (isPlainObj(schema.properties)) {
		const props = schema.properties as Record<string, JSONSchema7Definition>;
		for (const key of Object.keys(props)) {
			const prop = props[key];
			if (prop === undefined || typeof prop === "boolean") continue;
			if (hasOwn(prop, "oneOf") || hasOwn(prop, "anyOf")) return true;
			if (hasNestedBranching(prop)) return true;
		}
	}

	if (isPlainObj(schema.items) && typeof schema.items !== "boolean") {
		const items = schema.items as JSONSchema7;
		if (hasOwn(items, "oneOf") || hasOwn(items, "anyOf")) return true;
		if (hasNestedBranching(items)) return true;
	}

	return false;
}

/**
 * Checks `sub ⊆ sup` for a single property sub-schema, handling branches
 * on **both** sides.
 *
 * `isAtomicSubsetOf` only extracts branches from `sup`. When `sub` also
 * has `oneOf`/`anyOf`, we extract sub's branches and verify that **every**
 * branch is accepted by sup (same semantics as `checkBranchedSub`).
 */
function isPropertySubsetOf(
	sub: JSONSchema7Definition,
	sup: JSONSchema7Definition,
	engine: MergeEngine,
): boolean {
	const { branches: subBranches } = getBranchesTyped(sub);

	if (subBranches.length > 1 || subBranches[0] !== sub) {
		for (const branch of subBranches) {
			if (branch === undefined) continue;
			if (!isAtomicSubsetOf(branch, sup, engine)) return false;
		}
		return true;
	}

	return isAtomicSubsetOf(sub, sup, engine);
}

/**
 * Checks whether the array-level constraints of `sub` are compatible
 * with those of `sup` for subset semantics:
 * - `minItems`: sub.minItems must be >= sup.minItems
 * - `maxItems`: sub.maxItems must be <= sup.maxItems
 * - `uniqueItems`: if sup requires it, sub must too
 */
function isArrayConstraintsSubset(sub: JSONSchema7, sup: JSONSchema7): boolean {
	// minItems: sub.minItems must be >= sup.minItems
	if (sup.minItems !== undefined) {
		if (sub.minItems === undefined || sub.minItems < sup.minItems) {
			return false;
		}
	}
	// maxItems: sub.maxItems must be <= sup.maxItems
	if (sup.maxItems !== undefined) {
		if (sub.maxItems === undefined || sub.maxItems > sup.maxItems) {
			return false;
		}
	}
	// uniqueItems: if sup requires it, sub must also require it
	if (sup.uniqueItems === true && sub.uniqueItems !== true) {
		return false;
	}
	return true;
}

/**
 * Checks `sub ⊆ sup` by comparing object properties (and array items)
 * individually, using the full branching-aware logic.
 *
 * This is a **fallback** for when the merge-based check fails due to
 * `oneOf`/`anyOf` inside properties. It does NOT check object-level
 * keywords like `minProperties`/`maxProperties` — those are rare in
 * practice and are already handled correctly by the merge when the
 * branching isn't involved.
 *
 * @returns `true` if sub ⊆ sup, `false` otherwise.
 */
function isObjectSubsetByProperties(
	sub: JSONSchema7,
	sup: JSONSchema7,
	engine: MergeEngine,
): boolean {
	const subIsObj = sub.type === "object" || isPlainObj(sub.properties);
	const supIsObj = sup.type === "object" || isPlainObj(sup.properties);

	// ── Array path: both are arrays with items ──
	if (!subIsObj && !supIsObj) {
		if (
			sub.type === "array" &&
			sup.type === "array" &&
			isPlainObj(sub.items) &&
			isPlainObj(sup.items)
		) {
			if (
				!isPropertySubsetOf(
					sub.items as JSONSchema7Definition,
					sup.items as JSONSchema7Definition,
					engine,
				)
			) {
				return false;
			}
			return isArrayConstraintsSubset(sub, sup);
		}
		return false;
	}

	// Both must look like objects
	if (!subIsObj || !supIsObj) return false;

	// ── Type compatibility ──
	if (hasOwn(sub, "type") && hasOwn(sup, "type") && sub.type !== sup.type) {
		return false;
	}

	const subProps = (isPlainObj(sub.properties) ? sub.properties : {}) as Record<
		string,
		JSONSchema7Definition
	>;
	const supProps = (isPlainObj(sup.properties) ? sup.properties : {}) as Record<
		string,
		JSONSchema7Definition
	>;
	const subRequired = Array.isArray(sub.required)
		? (sub.required as string[])
		: [];
	const supRequired = Array.isArray(sup.required)
		? (sup.required as string[])
		: [];

	// ── Required: every key sup requires, sub must also require ──
	for (const key of supRequired) {
		if (!subRequired.includes(key)) return false;
	}

	// ── additionalProperties: false on sup ──
	if (sup.additionalProperties === false) {
		for (const key of Object.keys(subProps)) {
			if (!hasOwn(supProps, key)) return false;
		}
	}

	// ── Property-by-property check ──
	for (const key of Object.keys(supProps)) {
		const supProp = supProps[key];
		const subProp = subProps[key];
		if (supProp === undefined || subProp === undefined) continue;

		if (!isPropertySubsetOf(subProp, supProp, engine)) {
			return false;
		}
	}

	// ── Sub's extra properties vs sup's additionalProperties schema ──
	if (
		isPlainObj(sup.additionalProperties) &&
		typeof sup.additionalProperties !== "boolean"
	) {
		const addPropSchema = sup.additionalProperties as JSONSchema7Definition;
		for (const key of Object.keys(subProps)) {
			if (hasOwn(supProps, key)) continue;
			const subProp = subProps[key];
			if (subProp === undefined) continue;
			if (!isPropertySubsetOf(subProp, addPropSchema, engine)) {
				return false;
			}
		}
	}

	// ── Items (object schema that also has array items) ──
	if (isPlainObj(sub.items) && isPlainObj(sup.items)) {
		if (
			!isPropertySubsetOf(
				sub.items as JSONSchema7Definition,
				sup.items as JSONSchema7Definition,
				engine,
			)
		) {
			return false;
		}
		if (!isArrayConstraintsSubset(sub, sup)) {
			return false;
		}
	}

	return true;
}

/**
 * Attempts the property-by-property fallback when a merge-based check
 * fails and nested branching is detected.
 *
 * Encapsulates the guard (`hasNestedBranching`) and the call to
 * `isObjectSubsetByProperties` so callers don't repeat the pattern.
 *
 * @returns `true` if the fallback confirms sub ⊆ sup, `false` if it
 *          confirms sub ⊄ sup, `null` if the fallback is not applicable
 *          (neither schema has nested branching, or schemas are booleans).
 */
function tryNestedBranchingFallback(
	sub: JSONSchema7Definition,
	sup: JSONSchema7Definition,
	engine: MergeEngine,
): boolean | null {
	if (typeof sub === "boolean" || typeof sup === "boolean") return null;
	if (!hasNestedBranching(sub) && !hasNestedBranching(sup)) return null;
	return isObjectSubsetByProperties(sub, sup, engine);
}

// ─── Atomic subset check ─────────────────────────────────────────────────────

/**
 * Checks whether `sub ⊆ sup` for two schemas without anyOf/oneOf (or with
 * anyOf/oneOf only on the sup side).
 *
 * Point 7 — Integrates an extended `not` pre-check (`evaluateNot`) before the merge.
 *
 * When `evaluateNot` confirms compatibility (`true`), the `not` is removed
 * from `sup` before the merge to prevent the merge engine from adding a `not`
 * constraint that `sub` doesn't have (which would cause `isEqual(merged, sub)` to fail).
 *
 * Pattern pre-check — When both schemas have different patterns, checks
 * inclusion via sampling with `isPatternSubset`. If confirmed, removes the
 * pattern from sup before the merge (same strategy as for `not`).
 *
 * Principle: merge(sub, sup) ≡ sub → sub is a subset of sup.
 *
 * When the merge-based check fails and either sub or sup contains nested
 * `oneOf`/`anyOf` in properties or items, falls back to a property-by-property
 * comparison via `isObjectSubsetByProperties`.
 */

// ─── allOf resolution ────────────────────────────────────────────────────────
//
// When `sup` contains `allOf`, the merge engine resolves it during
// `merge(sub, sup)`, but the stripping pipeline (stripNotFromSup,
// stripDependenciesFromSup, etc.) runs **before** the merge and operates
// on the raw `sup` — it cannot see keywords nested inside `allOf` branches.
//
// `resolveSupAllOf` pre-resolves the `allOf` by merging all its branches
// into a single schema so that the stripping pipeline can operate on
// the flattened result. Any top-level keywords on `sup` alongside `allOf`
// are preserved by including them in the merge.

/**
 * If `sup` has an `allOf` array, resolve it by merging all branches
 * (plus any sibling keywords) into a single flattened schema.
 * Returns the original `sup` unchanged if there is no `allOf` or
 * if the merge fails.
 */
function resolveSupAllOf(
	sup: JSONSchema7Definition,
	engine: MergeEngine,
): JSONSchema7Definition {
	if (typeof sup === "boolean") return sup;
	if (!Array.isArray(sup.allOf) || sup.allOf.length === 0) return sup;

	// Collect sibling keywords (everything except `allOf`) into a base schema.
	// This handles cases like { allOf: [...], type: "object" }.
	const { allOf: _allOf, ...sibling } = sup;
	const branches = sup.allOf as JSONSchema7Definition[];

	// Start from the sibling keywords (or first branch if no siblings).
	let resolved: JSONSchema7Definition | null =
		Object.keys(sibling).length > 0 ? (sibling as JSONSchema7) : null;

	for (const branch of branches) {
		if (resolved === null) {
			resolved = branch;
		} else {
			resolved = engine.merge(resolved, branch);
			if (resolved === null) {
				// Merge failed — fall back to original sup so the existing
				// pipeline can still attempt the merge with allOf intact.
				return sup;
			}
		}
	}

	return resolved ?? sup;
}

export function isAtomicSubsetOf(
	sub: JSONSchema7Definition,
	sup: JSONSchema7Definition,
	engine: MergeEngine,
): boolean {
	// ── Resolve allOf in sup ──
	// Pre-flatten allOf so that the stripping pipeline (stripNotFromSup,
	// stripDependenciesFromSup, etc.) can see keywords from all branches.
	sup = resolveSupAllOf(sup, engine);

	const { branches: supBranches } = getBranchesTyped(sup);

	// Simple schema → direct merge
	if (supBranches.length === 1 && supBranches[0] === sup) {
		// Point 7: extended `not` pre-check
		const notResult = evaluateNot(sub, sup);
		if (notResult === false) return false;

		// ── Format pre-check ──
		// If both schemas have a different `format`, check that
		// sub.format ⊆ sup.format. Otherwise, sub cannot be ⊆ sup.
		// This complements hasFormatConflict (which handles the merge) by handling
		// the subset check direction that the merge cannot resolve.
		if (
			typeof sub !== "boolean" &&
			typeof sup !== "boolean" &&
			hasOwn(sub, "format") &&
			hasOwn(sup, "format") &&
			sub.format !== sup.format
		) {
			const fmtResult = isFormatSubset(
				sub.format as string,
				sup.format as string,
			);
			if (fmtResult !== true) return false;
		}

		// ── Pattern pre-check ──
		// If both schemas have different patterns, check inclusion
		// via sampling. If sub.pattern ⊄ sup.pattern (counter-example found),
		// we return false immediately. Otherwise, we can remove the pattern
		// from sup to avoid the structural false negative from the merge.
		if (
			typeof sub !== "boolean" &&
			typeof sup !== "boolean" &&
			hasOwn(sub, "pattern") &&
			hasOwn(sup, "pattern") &&
			sub.pattern !== sup.pattern
		) {
			const patResult = isPatternSubset(
				sub.pattern as string,
				sup.pattern as string,
			);
			if (patResult === false) return false;
		}

		// Remove `not` from sup (top-level and/or in properties)
		// when evaluateNot confirms compatibility at the corresponding level.
		// This prevents the merge engine from adding a `not` constraint that sub doesn't have
		// (which would cause merged ≠ sub and produce a false negative).
		let effectiveSup = sup;
		if (typeof sup !== "boolean") {
			// If top-level not is confirmed compatible → remove top-level not
			if (notResult === true) {
				effectiveSup = stripNotFromSup(sub, sup, true);
				// If sup only had `not` → sub is compatible (the not is resolved)
				if (
					typeof effectiveSup !== "boolean" &&
					Object.keys(effectiveSup).length === 0
				) {
					return true;
				}
			} else {
				// Even if the top-level not is not confirmed (null), we attempt
				// to remove `not` in individual properties
				// without touching the top-level `not`
				effectiveSup = stripNotFromSup(sub, sup, false);
			}

			// Remove patterns from sup confirmed by sampling.
			// Same strategy as for `not`: we remove the constraint already
			// satisfied by sub to prevent the merge from producing a combined
			// pattern (lookahead conjunction) structurally ≠ sub.
			effectiveSup = stripPatternFromSup(sub, effectiveSup);
			effectiveSup = stripRedundantBoundsFromSup(sub, effectiveSup);
			effectiveSup = stripDependenciesFromSup(sub, effectiveSup);
		}

		const merged = engine.merge(sub, effectiveSup);
		if (merged === null) {
			// ── Fallback: property-by-property for nested oneOf/anyOf ──
			return tryNestedBranchingFallback(sub, effectiveSup, engine) ?? false;
		}
		// Fast path: if merged is already structurally equal to sub,
		// skip normalize entirely. This is the common case when sub ⊆ sup
		// (A ∩ B = A), saving O(n) normalize traversal on wide schemas.
		if (semanticDeepEqual(merged, sub)) return true;

		// Strip vacuously-satisfied `false` properties added by the merge
		// from sup but absent in sub (vacuous truth: absent ⊆ forbidden).
		const strippedMerged = stripVacuousFalseProperties(merged, sub);
		if (strippedMerged !== merged && semanticDeepEqual(strippedMerged, sub)) {
			return true;
		}

		// Slow path: normalize to eliminate merge artifacts (e.g. redundant
		// enum when const is present), then compare.
		const normalizedMerged = normalize(strippedMerged);
		if (
			semanticDeepEqual(normalizedMerged, sub) ||
			engine.isEqual(normalizedMerged, sub)
		) {
			return true;
		}

		// ── Fallback: merged ≠ sub but nested branching may explain it ──
		// The merge engine preserves oneOf/anyOf as-is inside properties
		// (e.g. merge produces {type:"string", oneOf:[...]} ≠ sub).
		return tryNestedBranchingFallback(sub, effectiveSup, engine) ?? false;
	}

	// anyOf/oneOf in sup → at least one branch must accept sub
	return supBranches.some((branch) => {
		// Point 7: extended `not` pre-check per branch
		const notResult = evaluateNot(sub, branch);
		if (notResult === false) return false;

		// ── Pattern pre-check par branche ──
		if (
			typeof sub !== "boolean" &&
			typeof branch !== "boolean" &&
			hasOwn(sub, "pattern") &&
			hasOwn(branch, "pattern") &&
			sub.pattern !== branch.pattern
		) {
			const patResult = isPatternSubset(
				sub.pattern as string,
				branch.pattern as string,
			);
			if (patResult === false) return false;
		}

		// Same strip logic for branches
		let effectiveBranch = branch;
		if (typeof branch !== "boolean") {
			if (notResult === true) {
				effectiveBranch = stripNotFromSup(sub, branch, true);
				if (
					typeof effectiveBranch !== "boolean" &&
					Object.keys(effectiveBranch).length === 0
				) {
					return true;
				}
			} else {
				effectiveBranch = stripNotFromSup(sub, branch, false);
			}

			// Strip patterns confirmed by sampling
			effectiveBranch = stripPatternFromSup(sub, effectiveBranch);
			effectiveBranch = stripRedundantBoundsFromSup(sub, effectiveBranch);
			effectiveBranch = stripDependenciesFromSup(sub, effectiveBranch);
		}

		const merged = engine.merge(sub, effectiveBranch);
		if (merged === null) {
			// Fallback for nested branching within branches
			return tryNestedBranchingFallback(sub, effectiveBranch, engine) === true;
		}
		// Fast path: skip normalize if merged already equals sub
		if (semanticDeepEqual(merged, sub)) return true;

		// Strip vacuously-satisfied `false` properties (see comment above)
		const strippedBranch = stripVacuousFalseProperties(merged, sub);
		if (strippedBranch !== merged && semanticDeepEqual(strippedBranch, sub)) {
			return true;
		}

		const normalizedBranch = normalize(strippedBranch);
		if (
			semanticDeepEqual(normalizedBranch, sub) ||
			engine.isEqual(normalizedBranch, sub)
		) {
			return true;
		}

		// Fallback: merged ≠ sub but nested branching may explain it
		return tryNestedBranchingFallback(sub, effectiveBranch, engine) === true;
	});
}

// ─── Full subset check (with diffs) ─────────────────────────────────────────

/**
 * Checks `sub ⊆ sup` for a sub that has branches (anyOf/oneOf).
 * Each branch of sub must be accepted by sup.
 *
 * Point 6 — Uses `getBranchesTyped` to distinguish `anyOf[i]` from
 * `oneOf[i]` in diff paths.
 */
export function checkBranchedSub(
	subBranches: JSONSchema7Definition[],
	sup: JSONSchema7Definition,
	engine: MergeEngine,
	branchType: BranchType = "anyOf",
): SubsetResult {
	const allErrors: SchemaError[] = [];
	let allSubset = true;

	for (let i = 0; i < subBranches.length; i++) {
		const branch = subBranches[i];
		if (branch === undefined) continue;
		if (!isAtomicSubsetOf(branch, sup, engine)) {
			allSubset = false;
			const branchErrors = computeSemanticErrors(branch, sup, "");
			allErrors.push(...branchErrors);
		}
	}

	return {
		isSubset: allSubset,
		merged: allSubset
			? branchType === "oneOf"
				? { oneOf: subBranches }
				: { anyOf: subBranches }
			: null,
		errors: allErrors,
	};
}

/**
 * Checks `sub ⊆ sup` for a sup that has branches (anyOf/oneOf).
 * At least one branch of sup must accept sub.
 *
 * Point 6 — Uses the sup's branch type for more precise messages.
 */
export function checkBranchedSup(
	sub: JSONSchema7Definition,
	supBranches: JSONSchema7Definition[],
	engine: MergeEngine,
	_branchType: BranchType = "anyOf",
): SubsetResult {
	for (const branch of supBranches) {
		// Strip not + patterns confirmed by sampling before the merge
		let effectiveBranch = branch;
		if (typeof sub !== "boolean" && typeof branch !== "boolean") {
			const notResult = evaluateNot(sub, branch);
			if (notResult === false) continue; // This branch rejects sub

			if (notResult === true) {
				effectiveBranch = stripNotFromSup(sub, branch, true);
				if (
					typeof effectiveBranch !== "boolean" &&
					Object.keys(effectiveBranch).length === 0
				) {
					return { isSubset: true, merged: sub, errors: [] };
				}
			} else {
				effectiveBranch = stripNotFromSup(sub, branch, false);
			}
			effectiveBranch = stripPatternFromSup(sub, effectiveBranch);
			effectiveBranch = stripRedundantBoundsFromSup(sub, effectiveBranch);
			effectiveBranch = stripDependenciesFromSup(sub, effectiveBranch);
		}
		const merged = engine.merge(sub, effectiveBranch);
		if (merged !== null) {
			// Fast path: skip normalize if merged already equals sub
			if (deepEqual(merged, sub)) {
				return { isSubset: true, merged, errors: [] };
			}
			const normalizedMerged = normalize(merged);
			if (
				semanticDeepEqual(normalizedMerged, sub) ||
				engine.isEqual(normalizedMerged, sub)
			) {
				return { isSubset: true, merged, errors: [] };
			}
		}
	}

	// Generate semantic errors by comparing sub with the original sup
	const semanticErrors = computeSemanticErrors(
		sub,
		{ anyOf: supBranches } as JSONSchema7,
		"",
	);

	return {
		isSubset: false,
		merged: null,
		errors: semanticErrors,
	};
}

/**
 * Checks `sub ⊆ sup` for two atomic schemas (without anyOf/oneOf).
 * Uses `mergeOrThrow` to capture incompatibility errors.
 *
 * Uses `deepEqual` for structural comparison (with short-circuit
 * by reference and key counting).
 */
export function checkAtomic(
	sub: JSONSchema7Definition,
	sup: JSONSchema7Definition,
	engine: MergeEngine,
): SubsetResult {
	// ── Resolve allOf in sup ──
	// Same as in isAtomicSubsetOf: pre-flatten allOf so that the stripping
	// pipeline can see keywords from all branches.
	sup = resolveSupAllOf(sup, engine);

	// ── evaluateNot pre-check (aligned with isAtomicSubsetOf) ──
	const notResult =
		typeof sub !== "boolean" && typeof sup !== "boolean"
			? evaluateNot(sub, sup)
			: null;

	// If evaluateNot confirms incompatibility → fail immediately
	if (notResult === false) {
		const errors = computeSemanticErrors(sub, sup, "");
		return { isSubset: false, merged: null, errors };
	}

	// Strip not + patterns confirmed by sampling before the merge,
	// same strategy as in isAtomicSubsetOf to avoid structural false negatives
	// caused by the conjunction of patterns as lookahead.
	let effectiveSup = sup;
	if (typeof sub !== "boolean" && typeof sup !== "boolean") {
		// If the `not` is confirmed compatible → strip it before the merge
		if (notResult === true) {
			effectiveSup = stripNotFromSup(sub, sup, true);
			if (
				typeof effectiveSup !== "boolean" &&
				Object.keys(effectiveSup).length === 0
			) {
				return { isSubset: true, merged: sub, errors: [] };
			}
		} else {
			effectiveSup = stripNotFromSup(sub, sup, false);
		}
		effectiveSup = stripPatternFromSup(sub, effectiveSup);
		effectiveSup = stripRedundantBoundsFromSup(sub, effectiveSup);
		effectiveSup = stripDependenciesFromSup(sub, effectiveSup);
	}

	try {
		const merged = engine.mergeOrThrow(sub, effectiveSup);

		// Fast path: skip normalize if merged already equals sub
		if (deepEqual(merged, sub)) {
			return { isSubset: true, merged, errors: [] };
		}

		// Strip vacuously-satisfied `false` properties added by the merge
		// from sup but absent in sub (vacuous truth: absent ⊆ forbidden).
		const strippedMerged = stripVacuousFalseProperties(merged, sub);
		if (strippedMerged !== merged && semanticDeepEqual(strippedMerged, sub)) {
			return { isSubset: true, merged: strippedMerged, errors: [] };
		}

		const normalizedMerged = normalize(strippedMerged);

		if (
			semanticDeepEqual(normalizedMerged, sub) ||
			engine.isEqual(normalizedMerged, sub)
		) {
			return { isSubset: true, merged: normalizedMerged, errors: [] };
		}

		// ── Fallback: property-by-property for nested oneOf/anyOf ──
		if (tryNestedBranchingFallback(sub, effectiveSup, engine) === true) {
			return { isSubset: true, merged: sub, errors: [] };
		}

		const errors = computeSemanticErrors(sub, sup, "");
		return { isSubset: false, merged: normalizedMerged, errors };
	} catch (_e) {
		// ── Fallback: property-by-property for nested oneOf/anyOf ──
		if (tryNestedBranchingFallback(sub, effectiveSup, engine) === true) {
			return { isSubset: true, merged: sub, errors: [] };
		}

		const errors = computeSemanticErrors(sub, sup, "");
		return {
			isSubset: false,
			merged: null,
			errors,
		};
	}
}
