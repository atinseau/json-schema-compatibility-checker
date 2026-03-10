import type { JSONSchema7, JSONSchema7Definition } from "json-schema";
import type { MergeEngine } from "./merge-engine.ts";
import { isDataValidForSchema } from "./runtime-validator.ts";
import type { ResolvedConditionResult } from "./types.ts";
import {
	deepEqual,
	hasOwn,
	isPlainObj,
	mergeConstraints,
	omitKeys,
	unionStrings,
} from "./utils.ts";

// ─── Condition Resolver ──────────────────────────────────────────────────────
//
// Resolves `if/then/else` in a schema by evaluating the `if` against
// partial data (discriminants).
//
// Strategy:
//  1. Evaluate whether partial data satisfies the `if`
//  2. Merge the applicable branch (`then` or `else`) into the base schema
//  3. Remove the `if/then/else` keywords from the result
//  4. Recurse into `properties` to resolve nested conditions
//
// The `if` evaluation relies on a shared runtime validator
// to avoid duplicating partial validation logic.
// The resolver continues to orchestrate:
//   - evaluation of `if/then/else` branches
//   - merging the applicable branch
//   - recursive resolution of nested properties
//
// Uses custom utilities from `utils.ts`:
//   - `hasOwn` / `isPlainObj`   for safe property access and type checks
//   - `unionStrings`            for merging string arrays (required, deps)
//   - `omitKeys`                for excluding keys from objects

// ─── Keywords classification ─────────────────────────────────────────────────

/** Keywords that must not be processed by the generic loop in mergeBranchInto */
const SPECIAL_MERGE_KEYS = new Set(["required", "properties", "dependencies"]);

/** Keywords containing a single sub-schema (mergeable via engine.merge) */
const SUB_SCHEMA_KEYS = new Set([
	"additionalProperties",
	"items",
	"contains",
	"propertyNames",
	"not",
]);

/** Numeric keywords of "minimum" type (take the max to be more restrictive) */
const MIN_KEYS = new Set([
	"minimum",
	"exclusiveMinimum",
	"minLength",
	"minItems",
	"minProperties",
]);

/** Numeric keywords of "maximum" type (take the min to be more restrictive) */
const MAX_KEYS = new Set([
	"maximum",
	"exclusiveMaximum",
	"maxLength",
	"maxItems",
	"maxProperties",
]);

// ─── Condition evaluation (internal) ─────────────────────────────────────────

/**
 * Evaluates whether partial data satisfies an `if` schema.
 *
 * This version delegates runtime validation to the shared validator.
 * Only the resolver semantics are kept here:
 * if the data matches the `if`, apply `then`, otherwise `else`.
 */
function evaluateCondition(
	ifSchema: JSONSchema7,
	data: Record<string, unknown>,
): boolean {
	return isDataValidForSchema(ifSchema, data);
}

// ─── Discriminant extraction ─────────────────────────────────────────────────

/**
 * Keywords that indicate a property is a discriminant
 * (its value in the data is used for resolution).
 *
 * Point 5 — Extended with numeric/string/pattern constraints.
 */
const DISCRIMINANT_INDICATORS = [
	"const",
	"enum",
	"minimum",
	"maximum",
	"exclusiveMinimum",
	"exclusiveMaximum",
	"pattern",
	"minLength",
	"maxLength",
	"multipleOf",
	"minItems",
	"maxItems",
	"format",
] as const;

/**
 * Extracts discriminant values used in an `if` schema from partial data.
 *
 * Point 5 — Also collects discriminants for new constraints
 * (minimum, maximum, pattern, etc.).
 */
function extractDiscriminants(
	ifSchema: JSONSchema7,
	data: Record<string, unknown>,
	out: Record<string, unknown>,
): void {
	if (!isPlainObj(ifSchema.properties)) return;

	const props = ifSchema.properties as Record<string, JSONSchema7Definition>;
	for (const key of Object.keys(props)) {
		const propDef = props[key];
		if (typeof propDef === "boolean") continue;
		const prop = propDef as JSONSchema7;

		// Collect if at least one discriminant indicator is present
		const hasIndicator = DISCRIMINANT_INDICATORS.some((indicator) =>
			hasOwn(prop, indicator),
		);

		if (hasIndicator && hasOwn(data, key)) {
			out[key] = data[key];
		}
	}
}

// ─── Branch merging (deduplicated) ───────────────────────────────────────────

/**
 * Merges a conditional branch (`then` or `else`) into the resolved schema.
 *
 * Point 4 — Fix first-writer-wins:
 *   Instead of ignoring keywords already present in `resolved`,
 *   attempts a smart merge depending on the keyword type:
 *
 *   - `properties` → individual merge via engine.merge
 *   - `dependencies` → Point 3: union of arrays (form 1),
 *      merge of schemas (form 2)
 *   - Sub-schema keys → merge via engine.merge
 *   - Min keys → `Math.max` (more restrictive)
 *   - Max keys → `Math.min` (more restrictive)
 *   - `uniqueItems` → `true` wins over `false`
 *   - `pattern` / `format` → branch wins (more context-specific)
 *   - Others → attempt merge via engine, otherwise branch wins
 *
 * Uses custom utilities from `utils.ts` for each merge operation.
 */
function mergeBranchInto(
	resolved: JSONSchema7,
	branchDef: JSONSchema7Definition,
	engine: MergeEngine,
): void {
	if (typeof branchDef === "boolean") return;

	const branchSchema = branchDef as JSONSchema7;

	// ── Merge required via unionStrings (deduplicated automatically) ──
	if (Array.isArray(branchSchema.required)) {
		resolved.required = unionStrings(
			resolved.required ?? [],
			branchSchema.required,
		);
	}

	// ── Merge properties ──
	if (isPlainObj(branchSchema.properties)) {
		const branchProps = branchSchema.properties as Record<
			string,
			JSONSchema7Definition
		>;
		const mergedProps: Record<string, JSONSchema7Definition> = {
			...(resolved.properties ?? {}),
		};
		for (const key of Object.keys(branchProps)) {
			const branchProp = branchProps[key];
			if (branchProp === undefined) continue;
			const existing = resolved.properties?.[key];
			if (
				existing !== undefined &&
				typeof existing !== "boolean" &&
				typeof branchProp !== "boolean"
			) {
				const merged = engine.merge(
					existing as JSONSchema7Definition,
					branchProp as JSONSchema7Definition,
				);
				let mergedProp = (merged ?? branchProp) as JSONSchema7Definition;

				// The merge engine does not handle the custom `constraints`
				// keyword — it uses identity/first-wins for unknown keywords.
				// We need to manually union + dedup constraints from both
				// the existing property and the branch property so that all
				// runtime constraints are preserved in the resolved schema.
				if (typeof mergedProp !== "boolean") {
					const existingObj = existing as JSONSchema7;
					const branchObj = branchProp as JSONSchema7;
					const unionedConstraints = mergeConstraints(
						existingObj.constraints,
						branchObj.constraints,
					);
					if (unionedConstraints !== undefined) {
						mergedProp = { ...mergedProp, constraints: unionedConstraints };
					}
				}

				mergedProps[key] = mergedProp;
			} else {
				mergedProps[key] = branchProp;
			}
		}
		resolved.properties = mergedProps;
	}

	// ── Merge dependencies (Point 3) ──
	if (isPlainObj(branchSchema.dependencies)) {
		const resolvedDeps = (resolved.dependencies ?? {}) as Record<
			string,
			JSONSchema7Definition | string[]
		>;
		const branchDeps = branchSchema.dependencies as Record<
			string,
			JSONSchema7Definition | string[]
		>;

		const acc = { ...resolvedDeps };
		for (const depKey of Object.keys(branchDeps)) {
			const branchVal = branchDeps[depKey] as
				| JSONSchema7Definition
				| string[]
				| undefined;
			if (branchVal === undefined) continue;
			const existingVal = acc[depKey] as
				| JSONSchema7Definition
				| string[]
				| undefined;

			if (existingVal === undefined) {
				// No existing value → copy directly
				acc[depKey] = branchVal;
			} else if (Array.isArray(existingVal) && Array.isArray(branchVal)) {
				// Form 1: deduplicated union of string arrays
				acc[depKey] = unionStrings(
					existingVal as string[],
					branchVal as string[],
				);
			} else if (isPlainObj(existingVal) && isPlainObj(branchVal)) {
				// Form 2: merge sub-schemas
				const merged = engine.merge(
					existingVal as JSONSchema7Definition,
					branchVal as JSONSchema7Definition,
				);
				acc[depKey] = (merged ?? branchVal) as JSONSchema7Definition;
			} else {
				// Incompatible types (array vs schema) → branch wins
				acc[depKey] = branchVal;
			}
		}
		resolved.dependencies = acc as Record<
			string,
			JSONSchema7Definition | string[]
		>;
	}

	// ── Merge remaining keywords (Point 4 — fix first-writer-wins) ──
	for (const key of Object.keys(branchSchema) as (keyof JSONSchema7)[]) {
		// Skip keys already handled above
		if (SPECIAL_MERGE_KEYS.has(key)) continue;

		const branchVal = branchSchema[key];
		const resolvedVal = resolved[key];

		// If resolved doesn't have this key → copy directly
		if (resolvedVal === undefined) {
			(resolved as Record<string, unknown>)[key] = branchVal;
			continue;
		}

		// If both have the same value → nothing to do
		if (deepEqual(resolvedVal, branchVal)) continue;

		// ── Sub-schema keys → merge via engine ──
		if (SUB_SCHEMA_KEYS.has(key)) {
			const merged = engine.merge(
				resolvedVal as JSONSchema7Definition,
				branchVal as JSONSchema7Definition,
			);
			if (merged !== null) {
				(resolved as Record<string, unknown>)[key] = merged;
			} else {
				// Merge impossible → branch wins (conditional context)
				(resolved as Record<string, unknown>)[key] = branchVal;
			}
			continue;
		}

		// ── Min keys → Math.max (more restrictive) ──
		if (MIN_KEYS.has(key)) {
			if (typeof resolvedVal === "number" && typeof branchVal === "number") {
				(resolved as Record<string, unknown>)[key] = Math.max(
					resolvedVal,
					branchVal,
				);
			} else {
				(resolved as Record<string, unknown>)[key] = branchVal;
			}
			continue;
		}

		// ── Max keys → Math.min (more restrictive) ──
		if (MAX_KEYS.has(key)) {
			if (typeof resolvedVal === "number" && typeof branchVal === "number") {
				(resolved as Record<string, unknown>)[key] = Math.min(
					resolvedVal,
					branchVal,
				);
			} else {
				(resolved as Record<string, unknown>)[key] = branchVal;
			}
			continue;
		}

		// ── uniqueItems → true wins over false ──
		if (key === "uniqueItems") {
			(resolved as Record<string, unknown>)[key] =
				resolvedVal === true || branchVal === true;
			continue;
		}

		// ── pattern / format → branch wins (more context-specific) ──
		if (key === "pattern" || key === "format") {
			(resolved as Record<string, unknown>)[key] = branchVal;
			continue;
		}

		// ── constraints → union + dedup (intersection semantics) ──
		// Constraints follow allOf semantics: both the base and the branch
		// constraints must be satisfied. This is the same logic used by
		// the merge engine's applyConstraintsMerge post-processor.
		if (key === "constraints") {
			const merged = mergeConstraints(resolvedVal, branchVal);
			if (merged !== undefined) {
				(resolved as Record<string, unknown>)[key] = merged;
			}
			continue;
		}

		// ── Fallback: attempt merge via engine for remaining cases ──
		const base = { [key]: resolvedVal } as JSONSchema7Definition;
		const branch = { [key]: branchVal } as JSONSchema7Definition;
		const merged = engine.merge(base, branch);
		if (
			merged &&
			typeof merged !== "boolean" &&
			hasOwn(merged as object, key)
		) {
			(resolved as Record<string, unknown>)[key] = (
				merged as unknown as Record<string, unknown>
			)[key];
		} else {
			// Merge failed → branch wins (applicable conditional context)
			(resolved as Record<string, unknown>)[key] = branchVal;
		}
	}
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Resolves `if/then/else` in a schema by evaluating the `if` against
 * partial data (discriminants).
 *
 * @param schema  The schema potentially containing if/then/else
 * @param data    Partial data used to evaluate the conditions
 * @param engine  The MergeEngine for merging branches
 *
 * @example
 * ```ts
 * const form = {
 *   type: "object",
 *   properties: { accountType: { type: "string" }, ... },
 *   if:   { properties: { accountType: { const: "business" } } },
 *   then: { required: ["companyName"] },
 *   else: { required: ["firstName"] },
 * };
 *
 * const { resolved } = resolveConditions(form, { accountType: "business" }, engine);
 * // → resolved no longer has if/then/else, but has required: ["companyName"]
 * ```
 */
export function resolveConditions(
	schema: JSONSchema7,
	data: Record<string, unknown>,
	engine: MergeEngine,
): ResolvedConditionResult {
	let branch: "then" | "else" | null = null;
	const discriminant: Record<string, unknown> = {};

	// ── Fast path: no conditions at all ──
	// If there's no `if` and no `allOf` with conditions, skip the copy entirely.
	const hasTopLevelIf = schema.if !== undefined;
	const hasAllOfConditions =
		Array.isArray(schema.allOf) &&
		schema.allOf.some(
			(e) => typeof e !== "boolean" && hasOwn(e as object, "if"),
		);

	if (!hasTopLevelIf && !hasAllOfConditions) {
		// Phase 3 only: check nested properties (resolveNestedProperties
		// already returns the original if nothing changes)
		const resolved = resolveNestedProperties(
			schema,
			data,
			engine,
			discriminant,
		);
		return { resolved, branch, discriminant };
	}

	// ── Copy-on-write: only copy when mutations are needed ──
	let resolved = { ...schema };

	// ── Phase 1: Resolve if/then/else in allOf ──
	if (hasAllOfConditions) {
		resolved = resolveAllOfConditions(resolved, data, engine, discriminant);
	}

	// ── Phase 2: Resolve if/then/else at this level ──
	if (resolved.if !== undefined) {
		const ifSchema = resolved.if as JSONSchema7;
		const matches = evaluateCondition(ifSchema, data);

		extractDiscriminants(ifSchema, data, discriminant);

		const applicableBranch = matches ? resolved.then : resolved.else;
		branch = matches ? "then" : "else";

		if (applicableBranch) {
			mergeBranchInto(
				resolved,
				applicableBranch as JSONSchema7Definition,
				engine,
			);
		}

		delete resolved.if;
		delete resolved.then;
		delete resolved.else;
	}

	// ── Phase 3: Recurse into properties ──
	resolved = resolveNestedProperties(resolved, data, engine, discriminant);

	return { resolved, branch, discriminant };
}

// ─── Internal phases ─────────────────────────────────────────────────────────

/**
 * Phase 1: Iterates over `allOf` entries and resolves those containing
 * an `if/then/else`. Non-conditional entries are preserved.
 *

 */
function resolveAllOfConditions(
	resolved: JSONSchema7,
	data: Record<string, unknown>,
	engine: MergeEngine,
	discriminant: Record<string, unknown>,
): JSONSchema7 {
	if (!Array.isArray(resolved.allOf)) return resolved;

	const remainingAllOf: JSONSchema7Definition[] = [];

	for (const entry of resolved.allOf) {
		if (typeof entry === "boolean") {
			remainingAllOf.push(entry);
			continue;
		}

		const subSchema = entry as JSONSchema7;

		if (subSchema.if === undefined) {
			remainingAllOf.push(entry);
			continue;
		}

		// Resolve the condition of this allOf entry
		const ifSchema = subSchema.if as JSONSchema7;
		const matches = evaluateCondition(ifSchema, data);

		extractDiscriminants(ifSchema, data, discriminant);

		const applicableBranch = matches ? subSchema.then : subSchema.else;

		if (applicableBranch) {
			mergeBranchInto(
				resolved,
				applicableBranch as JSONSchema7Definition,
				engine,
			);
		}

		// Keep non-conditional parts of the allOf entry
		const remaining = omitKeys(
			subSchema as unknown as Record<string, unknown>,
			["if", "then", "else"],
		);
		if (Object.keys(remaining).length > 0) {
			remainingAllOf.push(remaining as JSONSchema7);
		}
	}

	resolved = { ...resolved };
	if (remainingAllOf.length === 0) {
		delete resolved.allOf;
	} else {
		resolved.allOf = remainingAllOf;
	}

	return resolved;
}

/**
 * Phase 3: Recurses into the `properties` of the resolved schema to resolve
 * nested conditions (e.g. an object whose property has an if/then/else).
 *

 */
function resolveNestedProperties(
	resolved: JSONSchema7,
	data: Record<string, unknown>,
	engine: MergeEngine,
	discriminant: Record<string, unknown>,
): JSONSchema7 {
	if (!isPlainObj(resolved.properties)) return resolved;

	const props = resolved.properties as Record<string, JSONSchema7Definition>;
	const propKeys = Object.keys(props);
	let changed = false;
	const resolvedProps: Record<string, JSONSchema7Definition> = {};

	for (const key of propKeys) {
		const propDef = props[key];
		if (propDef === undefined) continue;
		if (typeof propDef === "boolean") {
			resolvedProps[key] = propDef;
			continue;
		}

		const propSchema = propDef as JSONSchema7;
		const hasConditions =
			propSchema.if !== undefined ||
			(Array.isArray(propSchema.allOf) &&
				propSchema.allOf.some(
					(e) => typeof e !== "boolean" && hasOwn(e as object, "if"),
				));

		if (!hasConditions) {
			resolvedProps[key] = propDef;
			continue;
		}

		// Nested data available → resolve recursively
		const nestedData = isPlainObj(data[key])
			? (data[key] as Record<string, unknown>)
			: {};

		const nested = resolveConditions(propSchema, nestedData, engine);

		// Propagate nested discriminants with prefix
		for (const dk of Object.keys(nested.discriminant)) {
			discriminant[`${key}.${dk}`] = nested.discriminant[dk];
		}

		resolvedProps[key] = nested.resolved;
		changed = true;
	}

	return changed ? { ...resolved, properties: resolvedProps } : resolved;
}
