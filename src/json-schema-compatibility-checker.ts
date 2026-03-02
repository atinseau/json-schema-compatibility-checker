import type { JSONSchema7, JSONSchema7Definition } from "json-schema";
import { resolveConditions } from "./condition-resolver.ts";
import { narrowSchemaWithData } from "./data-narrowing.ts";
import { formatResult } from "./formatter.ts";
import { MergeEngine } from "./merge-engine.ts";
import { normalize } from "./normalizer.ts";
import {
	arePatternsEquivalent,
	isPatternSubset,
	isTrivialPattern,
} from "./pattern-subset.ts";
import type { BranchResult, BranchType } from "./subset-checker.ts";
import {
	checkAtomic,
	checkBranchedSub,
	checkBranchedSup,
	getBranchesTyped,
	isAtomicSubsetOf,
} from "./subset-checker.ts";
import type {
	CheckConditionsOptions,
	ResolvedConditionResult,
	ResolvedSubsetResult,
	SchemaError,
	SubsetResult,
} from "./types.ts";
import { deepEqual, isPlainObj } from "./utils.ts";

// ─── Re-exports ──────────────────────────────────────────────────────────────

export type {
	SchemaError,
	SubsetResult,
	ResolvedConditionResult,
	ResolvedSubsetResult,
	CheckConditionsOptions,
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
// Façade légère qui orchestre les sous-modules pour vérifier la compatibilité
// entre JSON Schemas (Draft-07).
//
// Principe mathématique :
//   A ⊆ B  ⟺  A ∩ B ≡ A
//
// En JSON Schema :
//   - A ∩ B  =  allOf([A, B])  résolu via merge
//   - ≡      =  comparaison structurelle
//
// @example
// ```ts
// const checker = new JsonSchemaCompatibilityChecker();
//
// checker.isSubset(strict, loose);             // true
// checker.check(loose, strict);                // { isSubset: false, diffs: [...] }
// checker.check(sub, sup, { subData: {...} }); // resolves conditions then checks
// ```

export class JsonSchemaCompatibilityChecker {
	private readonly engine: MergeEngine;

	constructor() {
		this.engine = new MergeEngine();
	}

	// ── Subset check (boolean) ─────────────────────────────────────────────

	/**
	 * Vérifie si `sub ⊆ sup`.
	 * Toute valeur valide pour sub est-elle aussi valide pour sup ?
	 *
	 * Point 6 — Utilise `getBranchesTyped` pour distinguer `anyOf` de `oneOf`
	 * en interne, bien que le résultat boolean ne reflète pas la distinction.
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
	 * Vérifie `sub ⊆ sup` et retourne un diagnostic complet
	 * avec des erreurs sémantiques lisibles.
	 *
	 * Si `options` est fourni avec `subData`, les conditions `if/then/else`
	 * des deux schemas sont résolues avant le check :
	 * - `subData` est utilisé pour résoudre les conditions du sub
	 * - `supData` (ou `subData` par défaut) est utilisé pour résoudre le sup
	 *
	 * @param sub - Le schema source (candidat subset)
	 * @param sup - Le schema cible (superset attendu)
	 * @param options - Options de résolution de conditions (optionnel)
	 * @returns SubsetResult si pas d'options, ResolvedSubsetResult si options fournies
	 *
	 * @example
	 * ```ts
	 * // Sans résolution de conditions
	 * checker.check(sub, sup);
	 *
	 * // Avec résolution de conditions (subData pour les deux)
	 * checker.check(sub, sup, { subData: { kind: "text" } });
	 *
	 * // Avec résolution séparée pour sub et sup
	 * checker.check(sub, sup, { subData: { kind: "text" }, supData: { kind: "other" } });
	 * ```
	 */
	check(
		sub: JSONSchema7Definition,
		sup: JSONSchema7Definition,
		options: CheckConditionsOptions,
	): ResolvedSubsetResult;
	check(sub: JSONSchema7Definition, sup: JSONSchema7Definition): SubsetResult;
	check(
		sub: JSONSchema7Definition,
		sup: JSONSchema7Definition,
		options?: CheckConditionsOptions,
	): SubsetResult | ResolvedSubsetResult {
		// ── Condition resolution path ──
		if (options) {
			const subData = options.subData;
			const supData = options.supData ?? options.subData;

			// resolveConditions expects Record<string, unknown> for property access;
			// coerce non-object data to empty object (no conditions to resolve for primitives)
			const subDataForConditions = isPlainObj(subData)
				? subData
				: ({} as Record<string, unknown>);
			const supDataForConditions = isPlainObj(supData)
				? supData
				: ({} as Record<string, unknown>);

			const resolvedSub = resolveConditions(
				sub as JSONSchema7,
				subDataForConditions,
				this.engine,
			);
			const resolvedSup = resolveConditions(
				sup as JSONSchema7,
				supDataForConditions,
				this.engine,
			);

			// ── Data narrowing ──
			// When runtime data is available, narrow the resolved schema by
			// constraining generic types to enum values when the data matches
			// the opposite schema's enum constraints.
			const narrowedSubResolved =
				subData !== undefined
					? narrowSchemaWithData(
							resolvedSub.resolved,
							subData,
							resolvedSup.resolved,
						)
					: resolvedSub.resolved;

			const narrowedSupResolved =
				supData !== undefined
					? narrowSchemaWithData(
							resolvedSup.resolved,
							supData,
							resolvedSub.resolved,
						)
					: resolvedSup.resolved;

			const result = this.checkInternal(
				narrowedSubResolved,
				narrowedSupResolved,
			);
			return {
				...result,
				resolvedSub: { ...resolvedSub, resolved: narrowedSubResolved },
				resolvedSup: { ...resolvedSup, resolved: narrowedSupResolved },
			};
		}

		// ── Standard path (no condition resolution) ──
		return this.checkInternal(sub, sup);
	}

	// ── Equality ───────────────────────────────────────────────────────────

	/**
	 * Vérifie l'égalité structurelle entre deux schemas.
	 */
	isEqual(a: JSONSchema7Definition, b: JSONSchema7Definition): boolean {
		return this.engine.isEqual(normalize(a), normalize(b));
	}

	// ── Intersection ───────────────────────────────────────────────────────

	/**
	 * Calcule l'intersection de deux schemas (allOf merge).
	 * Retourne null si les schemas sont incompatibles.
	 *
	 * Le résultat est normalisé pour éliminer les artefacts structurels
	 * du merge (ex: `enum` redondant quand `const` est présent).
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
	 * Normalise un schema : infère `type` depuis `const`/`enum`,
	 * et normalise récursivement tous les sous-schemas.
	 */
	normalize(def: JSONSchema7Definition): JSONSchema7Definition {
		return normalize(def);
	}

	// ── Formatting ─────────────────────────────────────────────────────────

	/**
	 * Formate un SubsetResult en chaîne lisible (utile pour logs/debug).
	 */
	formatResult(label: string, result: SubsetResult): string {
		return formatResult(label, result);
	}

	// ── Condition Resolution ────────────────────────────────────────────────

	/**
	 * Resolves `if/then/else` conditions in a schema by evaluating the `if`
	 * against partial data (discriminants).
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
	 * Logique interne de check sans résolution de conditions.
	 * Factorise le pipeline normalize → branch → atomic pour éviter
	 * la duplication entre les deux chemins de `check()`.
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

		// anyOf/oneOf dans sub
		if (subBranches.length > 1 || subBranches[0] !== nSub) {
			return checkBranchedSub(subBranches, nSup, this.engine, subBranchType);
		}

		// anyOf/oneOf dans sup uniquement
		if (supBranches.length > 1 || supBranches[0] !== nSup) {
			return checkBranchedSup(nSub, supBranches, this.engine, supBranchType);
		}

		// Cas standard
		return checkAtomic(nSub, nSup, this.engine);
	}
}
