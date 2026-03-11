import type { JSONSchema7, JSONSchema7Definition } from "json-schema";
import { resolveConditions } from "./condition-resolver.ts";
import { validateSchemaConstraints } from "./constraint-validator.ts";
import { narrowSchemaWithData } from "./data-narrowing.ts";
import { formatResult } from "./formatter.ts";
import { MergeEngine } from "./merge-engine.ts";
import { normalize } from "./normalizer.ts";
import {
	arePatternsEquivalent,
	isPatternSubset,
	isTrivialPattern,
} from "./pattern-subset.ts";
import {
	clearAllValidatorCaches,
	getRuntimeValidationErrors,
} from "./runtime-validator.ts";
import type { BranchResult, BranchType } from "./subset-checker.ts";
import {
	checkAtomic,
	checkBranchedSub,
	checkBranchedSup,
	getBranchesTyped,
	isAtomicSubsetOf,
} from "./subset-checker.ts";
import type {
	CheckerOptions,
	CheckRuntimeOptions,
	ConstraintValidatorRegistry,
	ResolvedConditionResult,
	ResolvedSubsetResult,
	SchemaError,
	SubsetResult,
	ValidateTargets,
} from "./types.ts";
import { deepEqual, isPlainObj } from "./utils.ts";
import { resolveValidateTargets } from "./validate-targets.ts";

// ─── Re-exports ──────────────────────────────────────────────────────────────

export type {
	SchemaError,
	SubsetResult,
	ResolvedConditionResult,
	ResolvedSubsetResult,
	CheckRuntimeOptions,
	ValidateTargets,
	BranchType,
	BranchResult,
};

export {
	normalize,
	resolveConditions,
	formatResult,
	MergeEngine,
	isPatternSubset,
	arePatternsEquivalent,
	isTrivialPattern,
};

// ─── Main Class ──────────────────────────────────────────────────────────────
//
// Lightweight facade that orchestrates sub-modules to verify compatibility
// between JSON Schemas (Draft-07).
//
// Mathematical principle:
//   A ⊆ B  ⟺  A ∩ B ≡ A
//
// In JSON Schema terms:
//   - A ∩ B  =  allOf([A, B])  resolved via merge
//   - ≡      =  structural comparison
//
// @example
// ```ts
// const checker = new JsonSchemaCompatibilityChecker();
//
// checker.isSubset(strict, loose);          // true
// checker.check(loose, strict);             // { isSubset: false, diffs: [...] }
// checker.check(sub, sup, { data: {...} }); // resolves conditions then checks
// ```

export class JsonSchemaCompatibilityChecker {
	private readonly constraintValidators: ConstraintValidatorRegistry;
	private readonly engine: MergeEngine;

	constructor(options?: CheckerOptions) {
		this.engine = new MergeEngine();
		this.constraintValidators = options?.constraints ?? {};
	}

	// ── Subset check (boolean) ─────────────────────────────────────────────

	/**
	 * Checks whether `sub ⊆ sup`.
	 * Is every value valid for sub also valid for sup?
	 *
	 * Uses `getBranchesTyped` to distinguish `anyOf` from `oneOf`
	 * internally, although the boolean result does not reflect the distinction.
	 */
	isSubset(sub: JSONSchema7Definition, sup: JSONSchema7Definition): boolean {
		// ── Identity short-circuit ──
		// If sub and sup are the same reference, sub ⊆ sup is trivially true.
		// This avoids the entire normalize + merge + compare pipeline.
		if (sub === sup) return true;

		// ── Pre-normalize structural equality ──
		// If sub and sup are structurally identical before normalization,
		// they represent the same schema → sub ⊆ sup trivially.
		// This avoids the WeakMap overhead of normalize() for common cases
		// like {} ⊆ {} or identical schema objects with different references.
		if (deepEqual(sub, sup)) return true;

		const nSub = normalize(sub);
		const nSup = normalize(sup);

		// ── Post-normalize structural identity ──
		// After normalization, schemas that were syntactically different
		// but semantically equivalent become structurally equal
		// (e.g. {const:1} vs {const:1, type:"integer"}).
		if (nSub !== sub && nSup !== sup && deepEqual(nSub, nSup)) return true;
		if (nSub !== nSup && deepEqual(nSub, nSup)) return true;

		const { branches: subBranches } = getBranchesTyped(nSub);

		if (subBranches.length > 1 || subBranches[0] !== nSub) {
			return subBranches.every((branch) =>
				isAtomicSubsetOf(branch, nSup, this.engine),
			);
		}

		return isAtomicSubsetOf(nSub, nSup, this.engine);
	}

	// ── Subset check (detailed) ────────────────────────────────────────────

	/**
	 * Checks `sub ⊆ sup` and returns a detailed diagnostic
	 * with human-readable semantic errors.
	 *
	 * When `options` is provided, both schemas go through runtime-aware
	 * processing before the static check:
	 *   1. Conditions (`if/then/else`) are resolved using `data`
	 *      (if `data` is `undefined`, conditions are resolved with `{}`)
	 *   2. Schemas are narrowed using runtime values (enum materialization)
	 *   3. The static subset check runs on the resolved/narrowed schemas
	 *
	 * When `validate` is enabled, additional runtime steps run **after** the
	 * static check passes:
	 *   4. `data` is validated against the targeted resolved schema(s) via AJV
	 *   5. Custom constraints are validated against `data` for the targeted schema(s)
	 *
	 * `validate` accepts:
	 *   - `true` — validate against **both** sub and sup
	 *   - `{ sub: true }` — validate only against the sub schema
	 *   - `{ sup: true }` — validate only against the sup schema
	 *   - `{ sub: true, sup: true }` — equivalent to `true`
	 *
	 * @param sub - The source schema (subset candidate)
	 * @param sup - The target schema (expected superset)
	 * @param options - Runtime options with `data` and optional `validate` flag
	 * @returns SubsetResult if no options, ResolvedSubsetResult if options provided
	 *
	 * @example
	 * ```ts
	 * // Static check (no runtime data)
	 * checker.check(sub, sup);
	 *
	 * // Resolve conditions + narrowing + static check (no runtime validation)
	 * checker.check(sub, sup, { data: { kind: "text", value: "hello" } });
	 *
	 * // Full pipeline including AJV + constraint runtime validation
	 * checker.check(sub, sup, { data: { kind: "text", value: "hello" }, validate: true });
	 * ```
	 */
	check(
		sub: JSONSchema7Definition,
		sup: JSONSchema7Definition,
		options: CheckRuntimeOptions,
	): Promise<ResolvedSubsetResult>;
	check(sub: JSONSchema7Definition, sup: JSONSchema7Definition): SubsetResult;
	check(
		sub: JSONSchema7Definition,
		sup: JSONSchema7Definition,
		options?: CheckRuntimeOptions,
	): SubsetResult | Promise<ResolvedSubsetResult> {
		// ── Runtime-aware path ──
		if (options) {
			return this.checkWithOptions(sub, sup, options);
		}

		// ── Standard path (no condition resolution) ──
		return this.checkInternal(sub, sup);
	}

	// ── Equality ───────────────────────────────────────────────────────────

	/**
	 * Checks structural equality between two schemas.
	 */
	isEqual(a: JSONSchema7Definition, b: JSONSchema7Definition): boolean {
		return this.engine.isEqual(normalize(a), normalize(b));
	}

	// ── Intersection ───────────────────────────────────────────────────────

	/**
	 * Computes the intersection of two schemas (allOf merge).
	 * Returns null if the schemas are incompatible.
	 *
	 * The result is normalized to eliminate structural artifacts
	 * from the merge (e.g. redundant `enum` when `const` is present).
	 */
	intersect(
		a: JSONSchema7Definition,
		b: JSONSchema7Definition,
	): JSONSchema7Definition | null {
		// ── Identity short-circuit ──
		// If a and b are the same reference or structurally equal,
		// intersection is just normalize(a) — skip the merge entirely.
		if (a === b || deepEqual(a, b)) return normalize(a);

		const nA = normalize(a);
		const nB = normalize(b);

		// ── Post-normalize identity ──
		if (deepEqual(nA, nB)) return nA;

		const merged = this.engine.merge(nA, nB);
		if (merged === null) return null;
		// Fast path: if merge result equals one of the normalized inputs,
		// it's already normalized — skip redundant normalize call.
		if (deepEqual(merged, nA) || deepEqual(merged, nB)) return merged;
		return normalize(merged);
	}

	// ── Normalization ──────────────────────────────────────────────────────

	/**
	 * Normalizes a schema: infers `type` from `const`/`enum`,
	 * and recursively normalizes all sub-schemas.
	 */
	normalize(def: JSONSchema7Definition): JSONSchema7Definition {
		return normalize(def);
	}

	// ── Formatting ─────────────────────────────────────────────────────────

	/**
	 * Formats a SubsetResult into a readable string (useful for logs/debug).
	 */
	formatResult(label: string, result: SubsetResult): string {
		return formatResult(label, result);
	}

	// ── Condition Resolution ────────────────────────────────────────────────

	/**
	 * Resolves `if/then/else` conditions in a schema by evaluating the `if`
	 * against runtime data.
	 *
	 * @param schema - The schema containing conditions to resolve
	 * @param data - The runtime data used to evaluate conditions
	 * @returns The resolved schema with branch info and discriminants
	 */
	resolveConditions(
		schema: JSONSchema7,
		data: Record<string, unknown>,
	): ResolvedConditionResult {
		return resolveConditions(schema, data, this.engine);
	}

	// ── Private ────────────────────────────────────────────────────────────

	/**
	 * Internal runtime-aware check logic. Extracted as an async method
	 * so that `check()` without options stays synchronous while the
	 * runtime path can `await` async constraint validators.
	 */
	private async checkWithOptions(
		sub: JSONSchema7Definition,
		sup: JSONSchema7Definition,
		options: CheckRuntimeOptions,
	): Promise<ResolvedSubsetResult> {
		const data = options.data;
		const { sub: validateSub, sup: validateSup } = resolveValidateTargets(
			options.validate,
		);

		// resolveConditions expects Record<string, unknown> for property access;
		// coerce non-object / undefined data to empty object so conditions
		// are always resolved (v1.0.11 compat: subData: undefined → {})
		const dataForConditions: Record<string, unknown> = isPlainObj(data)
			? data
			: {};

		const resolvedSub = resolveConditions(
			sub as JSONSchema7,
			dataForConditions,
			this.engine,
		);
		const resolvedSup = resolveConditions(
			sup as JSONSchema7,
			dataForConditions,
			this.engine,
		);

		// ── Runtime-aware data narrowing ──
		// Apply narrowing only when concrete data is available.
		// When data is undefined there is nothing to narrow with.
		// Boolean schemas (true/false) cannot be narrowed — skip narrowing
		// to avoid passing a non-object to narrowSchemaWithData.
		const canNarrow = data !== undefined;
		const canNarrowSub = canNarrow && isPlainObj(resolvedSub.resolved);
		const canNarrowSup = canNarrow && isPlainObj(resolvedSup.resolved);

		const narrowedSubResolved = canNarrowSub
			? narrowSchemaWithData(resolvedSub.resolved, data, resolvedSup.resolved)
			: resolvedSub.resolved;

		const narrowedSupResolved = canNarrowSup
			? narrowSchemaWithData(resolvedSup.resolved, data, resolvedSub.resolved)
			: resolvedSup.resolved;

		// ── Static subset check ──
		// Structural incompatibilities are schema-level problems — they are
		// permanent regardless of the concrete data. Run this before runtime
		// validation so that static errors always surface with higher priority.
		const staticResult = this.checkInternal(
			narrowedSubResolved,
			narrowedSupResolved,
		);

		if (!staticResult.isSubset) {
			return {
				...staticResult,
				resolvedSub: { ...resolvedSub, resolved: narrowedSubResolved },
				resolvedSup: { ...resolvedSup, resolved: narrowedSupResolved },
			};
		}

		// ── Runtime validation (opt-in) ──
		// Runs when `validate` is truthy (boolean or object with sub/sup flags).
		// Validates the concrete data against the targeted resolved/narrowed
		// schema(s) via AJV, then runs custom constraint validators if registered.
		if ((validateSub || validateSup) && data !== undefined) {
			const runtimeErrors: SchemaError[] = [];

			// ── AJV validation ──
			if (validateSub) {
				runtimeErrors.push(
					...this.prefixRuntimeErrors(
						getRuntimeValidationErrors(narrowedSubResolved, data),
						"$sub",
					),
				);
			}

			if (validateSup) {
				runtimeErrors.push(
					...this.prefixRuntimeErrors(
						getRuntimeValidationErrors(narrowedSupResolved, data),
						"$sup",
					),
				);
			}

			// ── Constraint validation ──
			// Validate runtime data against custom constraints in the targeted
			// schema(s). If a schema declares constraints that are not registered
			// in the registry, validateSchemaConstraints will report them as
			// "unknown constraint (not registered)" errors.
			// Constraint validators may be async, so we await the results.
			if (validateSub) {
				runtimeErrors.push(
					...this.prefixRuntimeErrors(
						await validateSchemaConstraints(
							narrowedSubResolved,
							data,
							this.constraintValidators,
						),
						"$sub",
					),
				);
			}

			if (validateSup) {
				runtimeErrors.push(
					...this.prefixRuntimeErrors(
						await validateSchemaConstraints(
							narrowedSupResolved,
							data,
							this.constraintValidators,
						),
						"$sup",
					),
				);
			}

			if (runtimeErrors.length > 0) {
				return {
					isSubset: false,
					merged: null,
					errors: runtimeErrors,
					resolvedSub: { ...resolvedSub, resolved: narrowedSubResolved },
					resolvedSup: { ...resolvedSup, resolved: narrowedSupResolved },
				};
			}
		}

		return {
			...staticResult,
			resolvedSub: { ...resolvedSub, resolved: narrowedSubResolved },
			resolvedSup: { ...resolvedSup, resolved: narrowedSupResolved },
		};
	}

	private prefixRuntimeErrors(
		errors: SchemaError[],
		rootKey: "$sub" | "$sup",
	): SchemaError[] {
		return errors.map((error) => ({
			...error,
			key: error.key === "$root" ? rootKey : `${rootKey}.${error.key}`,
		}));
	}

	/**
	 * Internal check logic without condition resolution.
	 * Factorizes the normalize → branch → atomic pipeline to avoid
	 * duplication between the two paths of `check()`.
	 */
	private checkInternal(
		sub: JSONSchema7Definition,
		sup: JSONSchema7Definition,
	): SubsetResult {
		// ── Identity short-circuit ──
		// Same reference → no errors, no merge needed.
		if (sub === sup) {
			return { isSubset: true, merged: sub, errors: [] };
		}

		// ── Pre-normalize structural equality ──
		// Avoids WeakMap overhead for identical schemas ({} ⊆ {}, etc.).
		if (deepEqual(sub, sup)) {
			return { isSubset: true, merged: sub, errors: [] };
		}

		const nSub = normalize(sub);
		const nSup = normalize(sup);

		// ── Post-normalize structural identity ──
		// Catches semantically equivalent schemas after normalization.
		if (deepEqual(nSub, nSup)) {
			return { isSubset: true, merged: nSub, errors: [] };
		}

		const { branches: subBranches, type: subBranchType } =
			getBranchesTyped(nSub);
		const { branches: supBranches, type: supBranchType } =
			getBranchesTyped(nSup);

		// anyOf/oneOf in sub
		if (subBranches.length > 1 || subBranches[0] !== nSub) {
			return checkBranchedSub(subBranches, nSup, this.engine, subBranchType);
		}

		// anyOf/oneOf in sup only
		if (supBranches.length > 1 || supBranches[0] !== nSup) {
			return checkBranchedSup(nSub, supBranches, this.engine, supBranchType);
		}

		// Standard case
		return checkAtomic(nSub, nSup, this.engine);
	}

	// ── Cache management ───────────────────────────────────────────────────

	/**
	 * Clears all compiled AJV validator caches (WeakMap, LRU, and AJV internal).
	 *
	 * Useful for:
	 * - Long-running processes where schemas evolve over time
	 * - Test isolation (ensuring no cross-test cache pollution)
	 * - Memory pressure situations where cached validators are no longer needed
	 *
	 * After calling this, the next validation call will recompile validators
	 * from scratch — there is a one-time performance cost per unique schema.
	 *
	 * This is a static method because the AJV instance is a module-level
	 * singleton shared across all `JsonSchemaCompatibilityChecker` instances.
	 *
	 * @example
	 * ```ts
	 * JsonSchemaCompatibilityChecker.clearCache();
	 * ```
	 */
	static clearCache(): void {
		clearAllValidatorCaches();
	}
}
